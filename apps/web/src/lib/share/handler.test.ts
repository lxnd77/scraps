import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { handleShareRequest } from "./handler";
import { SHARE_MAX_AGE_MS, deleteShare, getShare, pruneShares, putShare } from "./store";

const ORIGIN = "https://scraps.test";
let factory: IDBFactory;

beforeEach(() => {
  factory = new IDBFactory();
});

function post(form: FormData): Request {
  return new Request(`${ORIGIN}/share-target`, { method: "POST", body: form });
}

function idFrom(response: Response): string {
  const location = new URL(response.headers.get("location")!);
  return location.searchParams.get("capture")!;
}

describe("handleShareRequest", () => {
  it("parks the payload and redirects to the board with the share id", async () => {
    const form = new FormData();
    form.set("title", "from youtube");
    form.set("text", "https://youtu.be/abc");
    const res = await handleShareRequest(post(form), ORIGIN, factory);
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    const id = idFrom(res);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const stored = await getShare(id, factory);
    expect(stored).toMatchObject({ id, title: "from youtube", url: "https://youtu.be/abc" });
  });

  it("keeps the files so they can become a mood board later", async () => {
    const form = new FormData();
    for (const n of ["1", "2", "3"]) {
      form.append("files", new File([n], `${n}.png`, { type: "image/png" }));
    }
    const id = idFrom(await handleShareRequest(post(form), ORIGIN, factory));
    const stored = await getShare(id, factory);
    // fake-indexeddb clones through Node's structuredClone, which drops File names; real browsers
    // keep them, so only the count and the bytes are asserted here
    expect(stored?.files).toHaveLength(3);
    expect(stored?.files.every((f) => f.size === 1)).toBe(true);
  });

  it("opens a blank sheet when nothing usable was shared", async () => {
    const form = new FormData();
    form.set("title", "   ");
    const res = await handleShareRequest(post(form), ORIGIN, factory);
    expect(idFrom(res)).toBe("new");
  });

  it("never throws on a body that is not a form", async () => {
    const req = new Request(`${ORIGIN}/share-target`, { method: "POST", body: "plain" });
    const res = await handleShareRequest(req, ORIGIN, factory);
    expect(res.status).toBe(303);
    expect(idFrom(res)).toBe("new");
  });
});

describe("share store", () => {
  it("deletes a payload after it was used", async () => {
    await putShare({ id: "a", createdAt: Date.now(), files: [], text: "x" }, factory);
    await deleteShare("a", factory);
    expect(await getShare("a", factory)).toBeUndefined();
  });

  it("does not return or keep payloads older than a day", async () => {
    const old = Date.now() - SHARE_MAX_AGE_MS - 1000;
    await putShare({ id: "old", createdAt: old, files: [], text: "x" }, factory);
    await putShare({ id: "new", createdAt: Date.now(), files: [], text: "y" }, factory);
    expect(await getShare("old", factory)).toBeUndefined();
    await pruneShares(factory);
    expect(await getShare("new", factory)).toBeDefined();
  });
});
