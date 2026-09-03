import Link from "next/link";
import type { Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews, isoDate } from "@/lib/format";
import PortadaGenerica from "./PortadaGenerica";

export default function ArticleCard({
  article,
  index = 0,
  variante = "estandar",
}: {
  article: Article;
  index?: number;
  variante?: "estandar" | "amplia";
}) {
  const extra = article.extra_sources?.length ?? 0;
  const amplia = variante === "amplia";
  const proporcion = amplia ? "aspect-[16/9]" : "aspect-[16/10]";
  const sumario = article.dek || excerpt(article.body_md);

  return (
    <article className="card-modern group flex h-full flex-col overflow-hidden">
      <Link href={`/noticia/${article.slug}`} className="flex h-full flex-col">
        {/* Contenedor de Imagen */}
        <div className={`relative overflow-hidden bg-surface-2 ${proporcion}`}>
          {article.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              referrerPolicy="no-referrer"
              src={article.image_url}
              alt=""
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <PortadaGenerica
              categoria={article.category}
              className="absolute inset-0"
              grosor={amplia ? 2.5 : 2}
            />
          )}

          {/* Badge de categoría flotante */}
          <div className="absolute top-3 left-3">
            <span className="badge-pill bg-surface/90 text-fg backdrop-blur-md border border-border-subtle shadow-xs">
              {categoryName(article.category)}
            </span>
          </div>

          {/* Si tiene múltiples fuentes contrastadas */}
          {extra > 0 && (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-0.5 text-[0.65rem] font-semibold text-white backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {extra + 1} fuentes
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="flex flex-1 flex-col p-5">
          <h3
            className={`font-display font-black leading-snug tracking-tight text-fg transition-colors group-hover:text-accent ${
              amplia ? "text-xl sm:text-2xl" : "text-lg"
            }`}
          >
            {article.title}
          </h3>

          <p
            className={`font-serif mt-2.5 line-clamp-3 text-fg-muted leading-relaxed ${
              amplia ? "text-[1rem]" : "text-[0.92rem]"
            }`}
          >
            {sumario}
          </p>

          <div className="meta mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line/60 pt-3.5 text-xs text-fg-faint">
            <time dateTime={isoDate(article.published_at)}>
              {formatDate(article.published_at)}
            </time>
            <span aria-hidden="true" className="text-fg-faint/40">/</span>
            <span>{article.reading_minutes} min</span>
            <span aria-hidden="true" className="text-fg-faint/40">/</span>
            <span className="font-medium text-fg-muted truncate max-w-[9rem]">
              {article.source_name}
            </span>
            <span aria-hidden="true" className="text-fg-faint/40">/</span>
            <span>{formatViews(article.views)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
