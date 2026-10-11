import type { JSONContent } from "@tiptap/core";

// Document JSON to Markdown for the export (SPEC 9.9). Server safe and pure: media is referenced
// through a callback so the caller decides where files land in the zip.

export interface MarkdownOptions {
  /** the file name inside the zip for a storage path, or null to leave the media out */
  mediaFile?: (storagePath: string) => string | null;
  /** transcripts by asset id, written under a voice memo */
  transcripts?: Record<string, string>;
}

export interface MarkdownResult {
  title: string;
  markdown: string;
  /** storage paths of every picture and memo the document refers to */
  media: string[];
}

function inline(node: JSONContent): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "sticker") return `(sticker: ${String(node.attrs?.id ?? "sparkle")})`;
  if (typeof node.text !== "string") return (node.content ?? []).map(inline).join("");

  let out = node.text;
  const marks = (node.marks ?? []).map((m) => m.type);
  // code wins: other marks inside backticks would only be noise
  if (marks.includes("code")) return "`" + out.replace(/`/g, "'") + "`";
  if (marks.includes("bold")) out = `**${out}**`;
  if (marks.includes("italic")) out = `*${out}*`;
  if (marks.includes("strike")) out = `~~${out}~~`;
  if (marks.includes("highlight")) out = `==${out}==`;
  const link = (node.marks ?? []).find((m) => m.type === "link");
  const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;
  if (href) out = `[${out}](${href})`;
  return out;
}

function plain(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(plain).join(node.type === "doc" ? "\n" : "");
}

function indentLines(text: string, prefix: string, firstPrefix = prefix): string {
  return text
    .split("\n")
    .map((line, i) => (line === "" ? "" : (i === 0 ? firstPrefix : prefix) + line))
    .join("\n");
}

class Renderer {
  readonly media = new Set<string>();

  constructor(private readonly options: MarkdownOptions) {}

  private file(path: string | null | undefined): string | null {
    if (!path) return null;
    this.media.add(path);
    const mapper = this.options.mediaFile;
    return mapper ? mapper(path) : path;
  }

  blocks(nodes: JSONContent[]): string {
    return nodes
      .map((n) => this.block(n))
      .filter((s) => s !== "")
      .join("\n\n");
  }

  private list(node: JSONContent, kind: "bullet" | "ordered" | "task"): string {
    const items = node.content ?? [];
    return items
      .map((item, index) => {
        // a tight list: the item's own text and any nested list sit on consecutive lines
        const body = (item.content ?? [])
          .map((n) => this.block(n))
          .filter((s) => s !== "")
          .join("\n");
        let marker = "- ";
        if (kind === "ordered") marker = `${Number(node.attrs?.start ?? 1) + index}. `;
        if (kind === "task") marker = `- [${item.attrs?.checked === true ? "x" : " "}] `;
        return indentLines(body, " ".repeat(marker.length), marker);
      })
      .join("\n");
  }

  private table(node: JSONContent): string {
    const rows = (node.content ?? []).map((row) =>
      (row.content ?? []).map((cell) => plain(cell).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()),
    );
    if (rows.length === 0) return "";
    const width = Math.max(...rows.map((r) => r.length));
    const pad = (r: string[]) => [...r, ...Array.from({ length: width - r.length }, () => "")];
    const line = (r: string[]) => `| ${pad(r).join(" | ")} |`;
    const [head, ...rest] = rows;
    return [
      line(head!),
      `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
      ...rest.map(line),
    ].join("\n");
  }

  block(node: JSONContent): string {
    const children = node.content ?? [];
    switch (node.type) {
      case "title":
        return "";
      case "paragraph":
        return children.map(inline).join("");
      case "heading": {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
        return `${"#".repeat(level)} ${children.map(inline).join("")}`;
      }
      case "bigText":
        return `## ${children.map(inline).join("")}`;
      case "bulletList":
        return this.list(node, "bullet");
      case "orderedList":
        return this.list(node, "ordered");
      case "taskList":
        return this.list(node, "task");
      case "blockquote":
        return indentLines(this.blocks(children), "> ");
      case "callout":
        return indentLines(this.blocks(children), "> ");
      case "codeBlock": {
        const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
        return "```" + lang + "\n" + plain(node) + "\n```";
      }
      case "horizontalRule":
      case "divider":
        return "---";
      case "table":
        return this.table(node);
      case "image": {
        const file = this.file(node.attrs?.path as string | undefined);
        const alt = String(node.attrs?.alt ?? "") || String(node.attrs?.caption ?? "") || "image";
        const caption = String(node.attrs?.caption ?? "");
        const img = file ? `![${alt}](${file})` : `(image: ${alt})`;
        return caption ? `${img}\n\n*${caption}*` : img;
      }
      case "moodBoard": {
        const images = Array.isArray(node.attrs?.images)
          ? (node.attrs.images as Array<{ path?: string; caption?: string; alt?: string }>)
          : [];
        return images
          .map((img) => {
            const file = this.file(img.path);
            const alt = img.alt || img.caption || "image";
            const line = file ? `![${alt}](${file})` : `(image: ${alt})`;
            return img.caption ? `${line}\n\n*${img.caption}*` : line;
          })
          .join("\n\n");
      }
      case "linkEmbed": {
        const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
        if (!url) return "";
        const title = typeof node.attrs?.title === "string" && node.attrs.title ? node.attrs.title : url;
        const description =
          typeof node.attrs?.description === "string" ? node.attrs.description : "";
        return description ? `[${title}](${url})\n\n> ${description}` : `[${title}](${url})`;
      }
      case "voiceMemo": {
        const file = this.file(node.attrs?.path as string | undefined);
        const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : "";
        const author = String(node.attrs?.authorName ?? "");
        const label = author ? `voice memo by ${author}` : "voice memo";
        const link = file ? `[${label}](${file})` : label;
        const transcript = assetId ? this.options.transcripts?.[assetId] : undefined;
        return transcript ? `${link}\n\n> ${transcript.replace(/\n+/g, "\n> ")}` : link;
      }
      default:
        // an unknown block keeps its text rather than disappearing
        return children.length ? this.blocks(children) || children.map(inline).join("") : "";
    }
  }
}

/** The note body as Markdown (no front matter), its title, and the media it refers to. */
export function contentToMarkdown(doc: JSONContent, options: MarkdownOptions = {}): MarkdownResult {
  const children = doc.content ?? [];
  const titleNode = children[0]?.type === "title" ? children[0] : undefined;
  const body = titleNode ? children.slice(1) : children;
  const renderer = new Renderer(options);
  const markdown = renderer.blocks(body);
  return {
    title: titleNode ? plain(titleNode).replace(/\s+/g, " ").trim() : "",
    markdown,
    media: [...renderer.media],
  };
}
