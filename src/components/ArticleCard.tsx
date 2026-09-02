import Link from "next/link";
import type { Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews } from "@/lib/format";

export default function ArticleCard({
  article,
  index = 0,
}: {
  article: Article;
  index?: number;
}) {
  const extra = article.extra_sources?.length ?? 0;
  const vistas = formatViews(article.views);

  return (
    <article
      className="edge-glow rise group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-transform duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <Link href={`/noticia/${article.slug}`} className="flex h-full flex-col">
        {article.image_url && (
          <div className="overflow-hidden border-b border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image_url}
              alt=""
              loading="lazy"
              className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-neon">
            {categoryName(article.category)}
          </span>

          <h3 className="text-[17px] leading-snug font-semibold tracking-tight text-pretty transition-colors group-hover:text-neon">
            {article.title}
          </h3>

          <p className="text-[13.5px] leading-relaxed text-fg-muted">
            {article.dek || excerpt(article.body_md)}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 font-mono text-[11px] text-fg-faint">
            <time>{formatDate(article.published_at)}</time>
            <span className="opacity-40">·</span>
            <span>{article.reading_minutes} min</span>
            <span className="opacity-40">·</span>
            <span>{extra > 0 ? `${extra + 1} fuentes` : article.source_name}</span>
            {vistas && (
              <>
                <span className="opacity-40">·</span>
                <span>{vistas}</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
