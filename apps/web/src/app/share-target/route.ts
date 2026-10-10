import { NextResponse, type NextRequest } from "next/server";

/**
 * The service worker answers `POST /share-target` itself. This route only runs when a share
 * reaches the server (worker not installed yet, or a browser that bypassed it): the payload cannot
 * be recovered here, so send the person to the board with a blank capture sheet.
 */
export function POST(request: NextRequest) {
  const target = new URL("/", request.url);
  target.searchParams.set("capture", "new");
  return NextResponse.redirect(target, 303);
}
