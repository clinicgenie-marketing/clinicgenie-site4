import { fetchGenieWorksMedia, isMediaId, isPreviewToken } from "@/lib/genie-works";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Serves a Genie Works article image from this website's own origin. Published images may be
 * cached briefly; images for a private preview (?preview=token) are never cached or indexed.
 */
export async function GET(request: Request, { params }: { params: { mediaId: string } }) {
  const preview = new URL(request.url).searchParams.get("preview");
  if (!isMediaId(params.mediaId) || (preview !== null && !isPreviewToken(preview))) {
    return new Response("Not found", { status: 404 });
  }
  const upstream = await fetchGenieWorksMedia(params.mediaId, preview ?? undefined);
  const type = upstream?.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!upstream || !ALLOWED.has(type)) return new Response("Not found", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": preview ? "private, no-store" : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      ...(preview ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    },
  });
}
