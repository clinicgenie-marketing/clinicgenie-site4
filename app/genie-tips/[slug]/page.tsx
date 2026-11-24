import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenieTipArticleSidebar } from "@/components/blog/GenieTipArticleSidebar";
import { GenieTipCoverImage, GENIE_TIP_COVER_SIZES } from "@/components/blog/GenieTipCoverImage";
import { LatestGenieTipsSection } from "@/components/blog/LatestGenieTipsSection";
import { GenieWorksArticleView } from "@/components/blog/GenieWorksArticleView";
import { NotionArticleBody } from "@/components/blog/NotionArticleBody";
import { BackLink } from "@/components/ui/BackLink";
import { Container } from "@/components/ui/Container";
import { PageFinale } from "@/components/ui/PageFinale";
import { PageFinaleCTA } from "@/components/ui/PageFinaleCTA";
import { JsonLd } from "@/components/seo/JsonLd";
import { getGenieWorksArticle, mediaPath, type GenieWorksArticle } from "@/lib/genie-works";
import { getAllGenieTips } from "@/lib/genie-tips";
import { getPostBySlug } from "@/lib/notion";
import { publishedPageMetadata } from "@/lib/published-seo";
import {
  articleSchema,
  breadcrumbList,
  nestedBreadcrumbs,
  schemaGraph,
  webPageSchema,
} from "@/lib/schema";

export const revalidate = 60;

type GenieTipPageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  const posts = await getAllGenieTips();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: GenieTipPageProps): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  const genieWorks = post ? null : await getGenieWorksArticle(params.slug);

  if (genieWorks) {
    return genieWorksMetadata(genieWorks);
  }

  if (!post) {
    return publishedPageMetadata({
      title: "Genie Tip not found",
      description:
        "This Genie Tip could not be found. Browse clinic marketing insights from Clinic Genie.",
      path: "/genie-tips",
      index: false,
      follow: true,
    });
  }

  return publishedPageMetadata({
    title: `${post.title} | Genie Tips`,
    description:
      post.description ||
      "Clinic marketing insight from Clinic Genie for specialist clinics in Singapore.",
    path: `/genie-tips/${post.slug}`,
    keywords: post.tags.length > 0 ? post.tags : ["clinic marketing insights"],
    ogType: "article",
    index: !post.noIndex,
    follow: !post.noIndex,
    image: post.coverImage ?? undefined,
    publishedTime: post.date ?? undefined,
  });
}

/**
 * Genie Works checks these two tags when it verifies Ship to site: the revision shown, and a
 * same-origin featured image (Genie Works D89).
 */
async function genieWorksMetadata(article: GenieWorksArticle): Promise<Metadata> {
  const description =
    article.seoDescription ||
    article.excerpt ||
    "Clinic marketing insight from Clinic Genie for specialist clinics in Singapore.";
  const shareId = article.socialMediaId ?? article.featuredMediaId;
  const metadata = await publishedPageMetadata({
    title: `${article.seoTitle || article.title} | Genie Tips`,
    description,
    path: `/genie-tips/${article.slug}`,
    keywords: article.category ? [article.category] : ["clinic marketing insights"],
    ogType: "article",
    index: article.indexable,
    follow: article.indexable,
    image: shareId ? mediaPath(shareId) : undefined,
    publishedTime: article.publishedAt ?? undefined,
  });
  const other: Record<string, string> = { "genie-works-revision": article.versionId };
  if (article.featuredMediaId) other["genie-works-featured-image"] = mediaPath(article.featuredMediaId);
  return { ...metadata, other: { ...metadata.other, ...other } };
}

export default async function GenieTipPage({ params }: GenieTipPageProps) {
  const [post, allPosts] = await Promise.all([
    getPostBySlug(params.slug),
    getAllGenieTips(),
  ]);

  if (!post) {
    const article = await getGenieWorksArticle(params.slug);
    if (!article) notFound();
    return <GenieWorksTipPage article={article} allPosts={allPosts} />;
  }

  const latestPosts = allPosts
    .filter((item) => item.slug !== post.slug)
    .slice(0, 3);
  const path = `/genie-tips/${post.slug}`;
  const description =
    post.description ||
    "Clinic marketing insight from Clinic Genie for specialist clinics in Singapore.";

  return (
    <div className="min-h-screen bg-white text-ink-900">
      <JsonLd
        data={schemaGraph([
          webPageSchema({
            path,
            name: post.title,
            description,
          }),
          breadcrumbList(
            nestedBreadcrumbs([
              { name: "Genie Tips", path: "/genie-tips" },
              { name: post.title, path },
            ])
          ),
          post.noIndex
            ? null
            : articleSchema({
                title: post.title,
                description,
                path,
                datePublished: post.date,
                image: post.coverImage,
                keywords: post.tags.length > 0 ? post.tags : undefined,
              }),
        ])}
      />
      <article data-nav-theme="light">
        <Container size="content" className="pb-16 pt-24 sm:pb-20 sm:pt-28 lg:pt-32">
          <BackLink href="/genie-tips" label="Genie Tips" />

          <header className="mt-8 max-w-article">
            {post.dateLabel ? (
              <time
                dateTime={post.date ?? undefined}
                className="block text-sm text-ink-500"
              >
                {post.dateLabel}
              </time>
            ) : null}

            <h1 className="mt-3 font-display text-h1 text-balance text-ink-900">
              {post.title}
            </h1>

            {post.description ? (
              <p className="mt-5 max-w-prose text-lead text-pretty text-ink-500">
                {post.description}
              </p>
            ) : null}
          </header>

          <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:items-start lg:gap-x-12 lg:gap-y-12">
            {post.coverImage ? (
              <figure className="overflow-hidden rounded-2xl bg-cg-mist lg:col-span-8 lg:col-start-1 lg:row-start-1 xl:col-span-9">
                <GenieTipCoverImage
                  src={post.coverImage}
                  alt={post.title}
                  sizes={GENIE_TIP_COVER_SIZES.article}
                  priority
                />
              </figure>
            ) : null}

            <div className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 xl:col-span-3 xl:col-start-10">
              <GenieTipArticleSidebar
                tags={post.tags}
                category={post.category}
              />
            </div>

            <div
              className={
                post.coverImage
                  ? "min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-2 xl:col-span-9"
                  : "min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-1 xl:col-span-9"
              }
            >
              {post.markdown ? (
                <NotionArticleBody markdown={post.markdown} />
              ) : (
                <p className="text-lead text-ink-700">
                  This article is still being prepared. Please check back
                  shortly.
                </p>
              )}
            </div>
          </div>
        </Container>
      </article>

      <LatestGenieTipsSection posts={latestPosts} />

      <PageFinale backdropClassName="bg-cg-teal-5">
        <PageFinaleCTA
          kicker="Make your first wish"
          title="Want a clearer patient journey for your clinic?"
          highlight="clearer patient journey"
          body="Book a strategy call. We will map how patients find, understand, and enquire with your clinic, then show you where Clinic Genie can help."
          primaryCta={{ href: "/contact", label: "Make Your First Wish" }}
          secondaryCta={{ href: "/portfolio", label: "See Our Work" }}
          footnote="No obligation. No jargon. Just a clear next step."
        />
      </PageFinale>
    </div>
  );
}

function GenieWorksTipPage({
  article,
  allPosts,
}: {
  article: GenieWorksArticle;
  allPosts: Awaited<ReturnType<typeof getAllGenieTips>>;
}) {
  const path = `/genie-tips/${article.slug}`;
  const description =
    article.seoDescription ||
    article.excerpt ||
    "Clinic marketing insight from Clinic Genie for specialist clinics in Singapore.";
  const latestPosts = allPosts.filter((item) => item.slug !== article.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-ink-900">
      <JsonLd
        data={schemaGraph([
          webPageSchema({ path, name: article.title, description }),
          breadcrumbList(
            nestedBreadcrumbs([
              { name: "Genie Tips", path: "/genie-tips" },
              { name: article.title, path },
            ])
          ),
          article.indexable
            ? articleSchema({
                title: article.title,
                description,
                path,
                datePublished: article.publishedAt?.slice(0, 10) ?? null,
                image: article.featuredMediaId ? mediaPath(article.featuredMediaId) : null,
                keywords: article.category ? [article.category] : undefined,
              })
            : null,
        ])}
      />
      <GenieWorksArticleView article={article} />
      <LatestGenieTipsSection posts={latestPosts} />
      <PageFinale backdropClassName="bg-cg-teal-5">
        <PageFinaleCTA
          kicker="Make your first wish"
          title="Want a clearer patient journey for your clinic?"
          highlight="clearer patient journey"
          body="Book a strategy call. We will map how patients find, understand, and enquire with your clinic, then show you where Clinic Genie can help."
          primaryCta={{ href: "/contact", label: "Make Your First Wish" }}
          secondaryCta={{ href: "/portfolio", label: "See Our Work" }}
          footnote="No obligation. No jargon. Just a clear next step."
        />
      </PageFinale>
    </div>
  );
}
