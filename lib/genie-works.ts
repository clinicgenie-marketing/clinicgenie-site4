import { timingSafeEqual } from "node:crypto";
import type { NotionPost } from "@/lib/notion";

/**
 * Genie Works blog articles (Genie Works decisions D15, D87, D89).
 *
 * Server only. Configure in the deployment, never with a NEXT_PUBLIC_ prefix:
 *   GENIE_WORKS_URL             Genie Works origin, e.g. https://genie-works.example
 *   GENIE_WORKS_WEBSITE_ID      this website's registry UUID in Genie Works
 *   GENIE_WORKS_SITE_TOKEN      the per-site token generated in Genie Works (same kind as SEO_SETTINGS_API_TOKEN)
 *   GENIE_WORKS_PUBLISH_SECRET  the publish secret saved in Genie Works → Blog → Publishing settings
 *
 * A missing variable, error, timeout or unexpected response returns no articles, so the
 * site keeps showing its Notion Genie Tips.
 */

export const GENIE_WORKS_TAG = "genie-works-blog";
/** Fallback refresh. Ship to site refreshes immediately through /api/genie-works/revalidate. */
export const GENIE_WORKS_REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_TOKEN = /^[A-Za-z0-9_-]{40,100}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type GenieWorksSpan = { text: string; bold?: boolean; italic?: boolean };

export type GenieWorksBlock =
  | { type: "paragraph"; text: string; spans?: GenieWorksSpan[] }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "link"; href: string; text: string }
  | { type: "image"; mediaId: string; alt: string };

export interface GenieWorksArticle {
  id: string;
  versionId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  authorName: string | null;
  featuredMediaId: string | null;
  featuredAlt: string | null;
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialMediaId: string | null;
  indexable: boolean;
  publishedAt: string | null;
  updatedAt: string;
  blocks: GenieWorksBlock[];
}

interface Config {
  origin: string;
  websiteId: string;
  token: string;
}

function config(): Config | null {
  const base = process.env.GENIE_WORKS_URL?.trim();
  const websiteId = process.env.GENIE_WORKS_WEBSITE_ID?.trim();
  const token = process.env.GENIE_WORKS_SITE_TOKEN?.trim();
  if (!base || !websiteId || !token || !UUID.test(websiteId)) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return { origin: url.origin, websiteId, token };
  } catch {
    return null;
  }
}

export function isGenieWorksConfigured(): boolean {
  return config() !== null;
}

/** Constant-time check of the publish secret sent by Genie Works. False when no secret is configured. */
export function isPublishSecret(authorization: string | null): boolean {
  const secret = process.env.GENIE_WORKS_PUBLISH_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match) return false;
  const given = Buffer.from(match[1]!);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function isPreviewToken(value: string | null | undefined): value is string {
  return typeof value === "string" && PREVIEW_TOKEN.test(value);
}

export function isMediaId(value: string): boolean {
  return UUID.test(value);
}

/** Same-origin address of an image, served by app/api/genie-works/media. */
export function mediaPath(mediaId: string, previewToken?: string): string {
  const base = `/api/genie-works/media/${encodeURIComponent(mediaId)}`;
  return previewToken ? `${base}?preview=${encodeURIComponent(previewToken)}` : base;
}

const str = (value: unknown, max = 2000): string => (typeof value === "string" ? value.slice(0, max) : "");
const optionalId = (value: unknown): string | null => (typeof value === "string" && UUID.test(value) ? value : null);
const safeHref = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

function parseBlocks(value: unknown): GenieWorksBlock[] {
  const raw = (value as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): GenieWorksBlock[] => {
    const block = item as Record<string, unknown>;
    switch (block?.type) {
      case "paragraph": {
        const spans = Array.isArray(block.spans)
          ? (block.spans as unknown[]).flatMap((span): GenieWorksSpan[] => {
              const s = span as Record<string, unknown>;
              return typeof s?.text === "string" ? [{ text: s.text, bold: s.bold === true, italic: s.italic === true }] : [];
            })
          : undefined;
        return [{ type: "paragraph", text: str(block.text, 10000), spans }];
      }
      case "heading":
        return [{ type: "heading", level: block.level === 3 ? 3 : 2, text: str(block.text, 300) }];
      case "list":
        return Array.isArray(block.items)
          ? [{ type: "list", ordered: block.ordered === true, items: (block.items as unknown[]).map((entry) => str(entry, 2000)) }]
          : [];
      case "link": {
        const href = safeHref(str(block.href, 500));
        return href ? [{ type: "link", href, text: str(block.text, 300) || href }] : [];
      }
      case "image": {
        const mediaId = optionalId(block.mediaId);
        return mediaId ? [{ type: "image", mediaId, alt: str(block.alt, 300) }] : [];
      }
      default:
        return [];
    }
  });
}

function parseArticle(value: unknown): GenieWorksArticle | null {
  const raw = value as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const slug = str(raw.slug, 200);
  const versionId = optionalId(raw.versionId);
  if (!SLUG.test(slug) || !versionId) return null;
  const title = str(raw.title, 300) || "Untitled";
  return {
    id: str(raw.id, 100) || versionId,
    versionId,
    slug,
    title,
    excerpt: str(raw.excerpt, 1000),
    category: str(raw.category, 200),
    authorName: str(raw.authorName, 200) || null,
    featuredMediaId: optionalId(raw.featuredMediaId),
    featuredAlt: str(raw.featuredAlt, 300) || null,
    seoTitle: str(raw.seoTitle, 300) || title,
    seoDescription: str(raw.seoDescription, 500),
    socialTitle: str(raw.socialTitle, 300),
    socialDescription: str(raw.socialDescription, 500),
    socialMediaId: optionalId(raw.socialMediaId),
    indexable: raw.indexable !== false,
    publishedAt: str(raw.publishedAt, 40) || null,
    updatedAt: str(raw.updatedAt, 40),
    blocks: parseBlocks(raw.body),
  };
}

async function getJson(url: string, token: string, init: { revalidate?: number; tags?: string[]; noStore?: boolean }): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(init.noStore ? { cache: "no-store" as const } : { next: { revalidate: init.revalidate, tags: init.tags } }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Released Genie Works articles for this website, newest first. Empty when not configured or unavailable. */
export async function getGenieWorksArticles(): Promise<GenieWorksArticle[]> {
  const cfg = config();
  if (!cfg) return [];
  const body = await getJson(`${cfg.origin}/api/public/blog/${cfg.websiteId}`, cfg.token, {
    revalidate: GENIE_WORKS_REVALIDATE_SECONDS,
    tags: [GENIE_WORKS_TAG],
  });
  const articles = (body as { articles?: unknown } | null)?.articles;
  if (!Array.isArray(articles)) return [];
  return articles
    .map(parseArticle)
    .filter((article): article is GenieWorksArticle => article !== null)
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
}

export async function getGenieWorksArticle(slug: string): Promise<GenieWorksArticle | null> {
  if (!SLUG.test(slug)) return null;
  return (await getGenieWorksArticles()).find((article) => article.slug === slug) ?? null;
}

/** One saved revision for a private preview. Never cached. */
export async function getGenieWorksPreview(previewToken: string): Promise<GenieWorksArticle | null> {
  const cfg = config();
  if (!cfg || !isPreviewToken(previewToken)) return null;
  const body = await getJson(`${cfg.origin}/api/public/blog/${cfg.websiteId}/preview/${previewToken}`, cfg.token, { noStore: true });
  return parseArticle((body as { article?: unknown } | null)?.article);
}

/** Fetches an image from Genie Works with the site token. Published images may be cached; preview images are not. */
export async function fetchGenieWorksMedia(mediaId: string, previewToken?: string): Promise<Response | null> {
  const cfg = config();
  if (!cfg || !UUID.test(mediaId)) return null;
  if (previewToken !== undefined && !isPreviewToken(previewToken)) return null;
  const path = previewToken
    ? `/api/public/blog/${cfg.websiteId}/preview/${previewToken}/media/${mediaId}`
    : `/api/public/blog/${cfg.websiteId}/media/${mediaId}`;
  try {
    const response = await fetch(`${cfg.origin}${path}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      cache: "no-store",
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

const DATE_LABEL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" });

/** The listing card shape the Genie Tips pages already use for Notion posts. */
export function toPostCard(article: GenieWorksArticle): NotionPost {
  const date = article.publishedAt ?? article.updatedAt ?? null;
  let dateLabel: string | null = null;
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) dateLabel = DATE_LABEL.format(parsed);
  }
  return {
    id: `genie-works-${article.id}`,
    slug: article.slug,
    title: article.title,
    description: article.excerpt || article.seoDescription,
    date: date ? date.slice(0, 10) : null,
    dateLabel,
    tags: [],
    category: article.category || null,
    noIndex: !article.indexable,
    coverImage: article.featuredMediaId ? mediaPath(article.featuredMediaId) : null,
  };
}
