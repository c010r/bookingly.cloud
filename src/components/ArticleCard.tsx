import Link from "next/link";
import type { Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";

export function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const extra = article.extra_sources?.length ?? 0;

  return (
    <article className={featured ? "card featured" : "card"}>
      {article.image_url ? (
        // Imagen remota del medio original: <img> plano evita configurar dominios.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="thumb" src={article.image_url} alt="" loading="lazy" />
      ) : null}
      <div className="body">
        <Link href={`/categoria/${article.category}`} className="kicker">
          {categoryName(article.category)}
        </Link>
        <h3>
          <Link href={`/noticia/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.dek || excerpt(article.body_md)}</p>
        <div className="meta">
          <span>{formatDate(article.published_at)}</span>
          <span className="dot">·</span>
          <span>{article.reading_minutes} min</span>
          <span className="dot">·</span>
          <span className="source-chip">
            {extra > 0 ? `${extra + 1} fuentes` : `vía ${article.source_name}`}
          </span>
        </div>
      </div>
    </article>
  );
}
