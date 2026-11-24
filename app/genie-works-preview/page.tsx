import type { Metadata } from "next";
import { GenieWorksArticleView } from "@/components/blog/GenieWorksArticleView";
import { Container } from "@/components/ui/Container";
import { getGenieWorksPreview, isPreviewToken } from "@/lib/genie-works";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Article preview",
  robots: { index: false, follow: false, nocache: true },
};

type PreviewPageProps = { searchParams?: { token?: string } };

/** Private preview of one saved Genie Works revision (token valid for 72 hours). */
export default async function GenieWorksPreviewPage({ searchParams }: PreviewPageProps) {
  const token = searchParams?.token;
  const article = isPreviewToken(token) ? await getGenieWorksPreview(token) : null;

  return (
    <div className="min-h-screen bg-white text-ink-900">
      <div role="status" className="bg-genie-700 px-4 py-2 text-center text-sm font-medium text-white">
        Preview from Genie Works. This revision is not published and is hidden from search engines.
      </div>
      {article ? (
        <GenieWorksArticleView article={article} previewToken={token} />
      ) : (
        <Container size="content" className="py-32">
          <h1 className="font-display text-h2 text-ink-900">This preview is not available</h1>
          <p className="mt-4 text-lead text-ink-700">
            The link may have expired (previews last 72 hours) or the article was changed. Open Preview on website again from Genie Works.
          </p>
        </Container>
      )}
    </div>
  );
}
