import type { Metadata } from "next";
import { pageMetadata, type PageSeoInput } from "@/lib/seo";

/**
 * Published SEO settings from Genie Works (decision D12 in the Genie Works repo).
 *
 * Server only. Configure in the deployment, never with a NEXT_PUBLIC_ prefix:
 *   SEO_SETTINGS_API_URL    Genie Works origin, e.g. https://genie-works.example
 *   SEO_WEBSITE_ID          this website's registry UUID in Genie Works
 *   SEO_SETTINGS_API_TOKEN  the per-site token generated in Genie Works
 *
 * Any missing variable, error, timeout or unexpected response returns null,
 * and the site keeps the metadata and redirects defined in code.
 */

export interface PublishedSeoPage {
  path: string;
  title: string;
  description: string;
  canonicalPath: string | null;
  indexable: boolean;
}

export interface PublishedSeoRedirect {
  source: string;
  destination: string;
}

export interface PublishedSeo {
  pages: PublishedSeoPage[];
  redirects: PublishedSeoRedirect[];
  googleSiteVerification: string | null;
}

/** Seconds a published change can take to reach the site. */
export const PUBLISHED_SEO_REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 3000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function endpoint(): { url: string; token: string } | null {
  const base = process.env.SEO_SETTINGS_API_URL?.trim();
  const websiteId = process.env.SEO_WEBSITE_ID?.trim();
  const token = process.env.SEO_SETTINGS_API_TOKEN?.trim();
  if (!base || !websiteId || !token || !UUID.test(websiteId)) return null;
  try {
    const url = new URL(`/api/public/seo/${websiteId}`, base);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return { url: url.toString(), token };
  } catch {
    return null;
  }
}

/** Local path, same rules Genie Works applies when saving. */
function isLocalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\s?#\\]/.test(value) && value.length <= 500;
}

export function normalisePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") || "/" : withSlash;
}

function parse(body: unknown): PublishedSeo | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const pages = Array.isArray(raw.pages)
    ? raw.pages.flatMap((item): PublishedSeoPage[] => {
        const page = item as Record<string, unknown>;
        if (!isLocalPath(page?.path)) return [];
        return [{
          path: normalisePath(page.path),
          title: typeof page.title === "string" ? page.title.trim() : "",
          description: typeof page.description === "string" ? page.description.trim() : "",
          canonicalPath: isLocalPath(page.canonicalPath) ? page.canonicalPath : null,
          indexable: page.indexable !== false,
        }];
      })
    : [];
  const redirects = Array.isArray(raw.redirects)
    ? raw.redirects.flatMap((item): PublishedSeoRedirect[] => {
        const redirect = item as Record<string, unknown>;
        if (!isLocalPath(redirect?.source) || !isLocalPath(redirect?.destination)) return [];
        const source = normalisePath(redirect.source);
        const destination = normalisePath(redirect.destination);
        return source === destination ? [] : [{ source, destination }];
      })
    : [];
  const verification = typeof raw.googleSiteVerification === "string" && raw.googleSiteVerification.trim()
    ? raw.googleSiteVerification.trim()
    : null;
  return { pages, redirects, googleSiteVerification: verification };
}

/**
 * Fetches the published settings. `cacheInit` lets pages use the Next.js data
 * cache, while middleware (which has no data cache) passes `no-store` and keeps
 * its own short in-memory copy.
 */
export async function fetchPublishedSeo(cacheInit: RequestInit & { next?: { revalidate?: number } }): Promise<PublishedSeo | null> {
  const target = endpoint();
  if (!target) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(target.url, {
      ...cacheInit,
      headers: { Authorization: `Bearer ${target.token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("Published SEO settings unavailable", { status: response.status });
      return null;
    }
    return parse(await response.json());
  } catch (error) {
    console.warn("Published SEO settings unavailable", { name: error instanceof Error ? error.name : "UnknownError" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** For server components and generateMetadata. */
export function getPublishedSeo(): Promise<PublishedSeo | null> {
  return fetchPublishedSeo({ next: { revalidate: PUBLISHED_SEO_REVALIDATE_SECONDS } });
}

/**
 * `pageMetadata`, with the page's published Genie Works settings applied when
 * they exist. Fields left blank in Genie Works keep the code values.
 */
export async function publishedPageMetadata(input: PageSeoInput): Promise<Metadata> {
  if (!input.path) return pageMetadata(input);
  const published = await getPublishedSeo();
  const page = published?.pages.find((item) => item.path === normalisePath(input.path!));
  if (!page) return pageMetadata(input);
  const titleChanged = Boolean(page.title);
  return pageMetadata({
    ...input,
    title: page.title || input.title,
    description: page.description || input.description,
    path: page.canonicalPath ?? input.path,
    index: page.indexable ? input.index : false,
    // A published title replaces the code title, so the social title follows it.
    ogTitle: titleChanged ? undefined : input.ogTitle,
    absoluteTitle: titleChanged ? false : input.absoluteTitle,
  });
}
