import { isEmptyPayload, newShareId, parseShareForm } from "./payload";
import { pruneShares, putShare } from "./store";

export const SHARE_TARGET_PATH = "/share-target";

/**
 * The service worker's answer to `POST /share-target` (manifest `share_target`): park the payload
 * in IndexedDB and redirect to the board, which opens the capture sheet from it. It never touches
 * the network, so sharing works offline. Anything unreadable still lands on the board with a blank
 * capture sheet rather than an error page.
 */
export async function handleShareRequest(
  request: Request,
  origin: string,
  factory?: IDBFactory,
): Promise<Response> {
  const to = (search: string) => Response.redirect(new URL(`/${search}`, origin).toString(), 303);
  try {
    const payload = parseShareForm(await request.formData());
    if (isEmptyPayload(payload)) return to("?capture=new");
    const id = newShareId();
    await putShare({ ...payload, id, createdAt: Date.now() }, factory);
    // housekeeping must never delay or fail the hand-off
    void pruneShares(factory).catch(() => {});
    return to(`?capture=${id}`);
  } catch {
    return to("?capture=new");
  }
}
