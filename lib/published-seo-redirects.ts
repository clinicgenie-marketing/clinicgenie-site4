import { fetchPublishedSeo, normalisePath, PUBLISHED_SEO_REVALIDATE_SECONDS } from "@/lib/published-seo";

/**
 * Redirect lookup for middleware. Middleware has no Next.js data cache, so each
 * instance keeps the last result in memory. A failed fetch is retried after a
 * shorter delay and leaves the site's own routes in place.
 */
const FAILURE_RETRY_MS = 60_000;

let cached: { expires: number; redirects: Map<string, string> } | null = null;
let inflight: Promise<Map<string, string>> | null = null;

function configured(): boolean {
  return Boolean(process.env.SEO_SETTINGS_API_URL && process.env.SEO_WEBSITE_ID && process.env.SEO_SETTINGS_API_TOKEN);
}

async function load(): Promise<Map<string, string>> {
  const published = await fetchPublishedSeo({ cache: "no-store" });
  const redirects = new Map((published?.redirects ?? []).map((item) => [item.source, item.destination]));
  const ttl = published ? PUBLISHED_SEO_REVALIDATE_SECONDS * 1000 : FAILURE_RETRY_MS;
  cached = { expires: Date.now() + ttl, redirects };
  return redirects;
}

export async function publishedRedirectFor(pathname: string): Promise<string | null> {
  if (!configured()) return null;
  let redirects = cached && cached.expires > Date.now() ? cached.redirects : null;
  if (!redirects) {
    inflight ??= load().finally(() => {
      inflight = null;
    });
    redirects = await inflight;
  }
  return redirects.get(normalisePath(pathname)) ?? null;
}
