import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import { GENIE_TIP_COVER_SIZES } from "@/components/blog/GenieTipCoverImage";
import { mediaPath, type GenieWorksBlock, type GenieWorksSpan } from "@/lib/genie-works";

/** Same inline markers Genie Works uses: **bold** and _italic_. */
function parseInline(text: string): GenieWorksSpan[] {
  const spans: GenieWorksSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*|_([^_\n]+)_/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) spans.push({ text: text.slice(last, index) });
    if (match[1] != null) spans.push({ text: match[1], bold: true });
    else if (match[2] != null) spans.push({ text: match[2], italic: true });
    last = index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.filter((span) => span.text.length > 0);
}

function Inline({ text, spans }: { text: string; spans?: GenieWorksSpan[] }) {
  const source = spans?.length ? spans : parseInline(text);
  if (!source.length) return <>{text}</>;
  return (
    <>
      {source.map((span, index) => {
        let node: ReactNode = span.text;
        if (span.italic) node = <em>{node}</em>;
        if (span.bold) node = <strong>{node}</strong>;
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}

/** Renders a Genie Works article body with the same typography as Notion Genie Tips. React escapes all text. */
export function GenieWorksArticleBody({ blocks, previewToken }: { blocks: GenieWorksBlock[]; previewToken?: string }) {
  return (
    <div className="notion-article prose prose-lg max-w-none prose-headings:font-display prose-headings:text-ink-900 prose-p:text-ink-700 prose-a:text-genie-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink-900 prose-li:text-ink-700 prose-img:my-8 prose-img:rounded-xl">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 3 ? <h3 key={index}>{block.text}</h3> : <h2 key={index}>{block.text}</h2>;
          case "list": {
            const items = block.items.map((item, i) => <li key={i}><Inline text={item} /></li>);
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          case "link":
            return (
              <p key={index}>
                <a href={block.href} rel="noopener noreferrer">{block.text}</a>
              </p>
            );
          case "image":
            return (
              <figure key={index}>
                <Image
                  src={mediaPath(block.mediaId, previewToken)}
                  alt={block.alt || "Article image"}
                  width={1600}
                  height={1000}
                  sizes={GENIE_TIP_COVER_SIZES.body}
                  unoptimized={Boolean(previewToken)}
                  className="my-8 h-auto w-full rounded-xl object-cover shadow-card"
                />
              </figure>
            );
          default:
            return <p key={index}><Inline text={block.text} spans={block.spans} /></p>;
        }
      })}
    </div>
  );
}
