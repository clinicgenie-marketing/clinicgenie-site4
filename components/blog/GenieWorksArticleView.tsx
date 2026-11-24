import { GenieTipArticleSidebar } from "@/components/blog/GenieTipArticleSidebar";
import { GenieTipCoverImage, GENIE_TIP_COVER_SIZES } from "@/components/blog/GenieTipCoverImage";
import { GenieWorksArticleBody } from "@/components/blog/GenieWorksArticleBody";
import { BackLink } from "@/components/ui/BackLink";
import { Container } from "@/components/ui/Container";
import { mediaPath, toPostCard, type GenieWorksArticle } from "@/lib/genie-works";

/**
 * A Genie Works article in the Genie Tips article layout. Used by /genie-tips/[slug] and by the
 * private preview, so a preview looks exactly like the published page.
 */
export function GenieWorksArticleView({ article, previewToken }: { article: GenieWorksArticle; previewToken?: string }) {
  const card = toPostCard(article);
  const cover = article.featuredMediaId ? mediaPath(article.featuredMediaId, previewToken) : null;

  return (
    <article data-nav-theme="light">
      <Container size="content" className="pb-16 pt-24 sm:pb-20 sm:pt-28 lg:pt-32">
        <BackLink href="/genie-tips" label="Genie Tips" />

        <header className="mt-8 max-w-article">
          {card.dateLabel ? (
            <time dateTime={card.date ?? undefined} className="block text-sm text-ink-500">
              {card.dateLabel}
              {article.authorName ? ` · ${article.authorName}` : null}
            </time>
          ) : null}

          <h1 className="mt-3 font-display text-h1 text-balance text-ink-900">{article.title}</h1>

          {article.excerpt ? (
            <p className="mt-5 max-w-prose text-lead text-pretty text-ink-500">{article.excerpt}</p>
          ) : null}
        </header>

        <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:items-start lg:gap-x-12 lg:gap-y-12">
          {cover ? (
            <figure className="overflow-hidden rounded-2xl bg-cg-mist lg:col-span-8 lg:col-start-1 lg:row-start-1 xl:col-span-9">
              {previewToken ? (
                // Preview images must not enter the shared image optimiser cache.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={article.featuredAlt || article.title} className="aspect-[16/10] w-full object-cover" />
              ) : (
                <GenieTipCoverImage src={cover} alt={article.featuredAlt || article.title} sizes={GENIE_TIP_COVER_SIZES.article} priority />
              )}
            </figure>
          ) : null}

          <div className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 xl:col-span-3 xl:col-start-10">
            <GenieTipArticleSidebar tags={card.tags} category={card.category} />
          </div>

          <div
            className={
              cover
                ? "min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-2 xl:col-span-9"
                : "min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-1 xl:col-span-9"
            }
          >
            <GenieWorksArticleBody blocks={article.blocks} previewToken={previewToken} />
          </div>
        </div>
      </Container>
    </article>
  );
}
