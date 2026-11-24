import { getGenieWorksArticles, toPostCard } from "@/lib/genie-works";
import { getPublishedPosts, type NotionPost } from "@/lib/notion";

/**
 * Every published Genie Tip: Notion posts plus released Genie Works articles, newest first.
 * When both sources use the same slug, the Notion post keeps the address and the Genie Works
 * article is left out (Genie Works then reports "a different article" when it verifies).
 */
export async function getAllGenieTips(): Promise<NotionPost[]> {
  const [notion, genieWorks] = await Promise.all([
    getPublishedPosts(),
    getGenieWorksArticles().catch(() => []),
  ]);
  const taken = new Set(notion.map((post) => post.slug));
  const merged = [...notion, ...genieWorks.filter((article) => !taken.has(article.slug)).map(toPostCard)];
  return merged.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
