import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publishedRedirectFor } from "@/lib/published-seo-redirects";

const APEX_HOST = "clinic-genie.com";
const CANONICAL_HOST = "www.clinic-genie.com";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];

  if (hostname === APEX_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Redirects published from Genie Works. Paths in next.config.mjs redirects
  // are handled before middleware and keep priority.
  const { pathname } = request.nextUrl;
  if ((request.method === "GET" || request.method === "HEAD") && !pathname.startsWith("/api/")) {
    const destination = await publishedRedirectFor(pathname);
    if (destination) {
      const url = request.nextUrl.clone();
      url.pathname = destination;
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
