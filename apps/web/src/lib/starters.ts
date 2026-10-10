import { t } from "@/copy/en";
import { createNote } from "@/lib/notes";

/**
 * The three scraps every new board starts with: a welcome note, a sample checklist and a sample
 * quote. They go through createNote(), the same client function the capture sheet uses, so the
 * Phase 6 outbox covers them too. Ids are passed in so a retry never duplicates them.
 * The mood board starter from SPEC 6.6 arrives with the image block in Phase 4.
 */
export async function createStarterScraps(spaceId: string, ids: string[]): Promise<void> {
  const [welcome, list, quote] = ids;
  if (!welcome || !list || !quote) return;
  // sequential on purpose: the board lists newest first, so the welcome note lands on top
  await createNote({ id: quote, spaceId, start: "quote", text: t("starter.quote.text") });
  await createNote({
    id: list,
    spaceId,
    start: "list",
    title: t("starter.list.title"),
    items: [t("starter.list.1"), t("starter.list.2"), t("starter.list.3")],
  });
  await createNote({
    id: welcome,
    spaceId,
    start: "text",
    title: t("starter.welcome.title"),
    text: t("starter.welcome.body"),
  });
}
