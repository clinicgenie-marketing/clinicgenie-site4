import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { GENIE_WORKS_TAG, isPublishSecret } from "@/lib/genie-works";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** A local path such as /genie-tips or /genie-tips/my-article. */
function isLocalPath(value: unknown): value is string {
  return typeof value === "string" && /^\/[A-Za-z0-9/_-]{0,300}$/.test(value) && !value.includes("//");
}

/**
 * Genie Works D89: after Ship to site, Genie Works calls this with its publish secret so the
 * listing and the article page are rebuilt from the content API straight away.
 */
export async function POST(request: Request) {
  if (!isPublishSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: NO_STORE });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const requested = (body as { paths?: unknown } | null)?.paths;
  const paths = Array.isArray(requested) ? requested.filter(isLocalPath).slice(0, 20) : [];

  revalidateTag(GENIE_WORKS_TAG);
  for (const path of new Set(["/", "/genie-tips", "/sitemap.xml", ...paths])) {
    revalidatePath(path);
  }
  return NextResponse.json({ revalidated: true, paths }, { headers: NO_STORE });
}
