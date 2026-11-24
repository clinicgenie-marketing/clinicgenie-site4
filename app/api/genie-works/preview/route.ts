import { NextResponse } from "next/server";
import { isPreviewToken } from "@/lib/genie-works";

export const dynamic = "force-dynamic";

/**
 * Genie Works D89 "Preview on website" opens /api/genie-works/preview?token=…; the revision is
 * shown by /genie-works-preview in the site's own article layout, never cached or indexed.
 */
export function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isPreviewToken(token)) {
    return new NextResponse("Preview link is not valid.", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
  const target = new URL("/genie-works-preview", request.url);
  target.searchParams.set("token", token);
  return NextResponse.redirect(target, { status: 307, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
