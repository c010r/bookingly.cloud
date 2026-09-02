import Link from "next/link";
import type { Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews, isoDate } from "@/lib/format";
import PortadaGenerica from "./PortadaGenerica";

/**
 * Pieza de rejilla. Sin caja ni sombra: la separan el aire y un filete fino
 * sobre la fila de datos. La variante "amplia" es la que abre cada bloque de
 * la portada y va a doble ancho.
 */
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
  const proporcion = amplia ? "aspect-[16/9]" : "aspect-[3/2]";
  const sumario = article.dek || excerpt(article.body_md);

  return (
    <article className="grupo-pieza group flex h-full flex-col">
      <Link href={`/noticia/${article.slug}`} className="flex h-full flex-col">
        {/* La caja la fija el contenedor, no el contenido: una pieza con
            portada generica ocupa exactamente lo mismo que una con foto. */}
        <div className={`relative overflow-hidden bg-surface-2 ${proporcion}`}>
          {article.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              // Varios CDN devuelven 403 si el referer es otro dominio; sin el sirven igual.
              referrerPolicy="no-referrer"
              src={article.image_url}
              alt=""
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <PortadaGenerica
              categoria={article.category}
              className="absolute inset-0"
              grosor={amplia ? 2.5 : 2}
            />
          )}
        </div>

        <div className="flex flex-1 flex-col pt-4">
          <span className="etiqueta text-accent">{categoryName(article.category)}</span>

          <h3 className={`enlace-titular mt-2.5 ${amplia ? "titular-l" : "titular-m"}`}>
            {article.title}
          </h3>

          <p
            className={`entradilla mt-3 line-clamp-3 text-fg-muted ${
              amplia ? "max-w-2xl text-[1.0625rem]" : "text-[0.95rem]"
            }`}
          >
            {sumario}
          </p>

          <div className="meta mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line pt-3 text-fg-faint [&>span]:whitespace-nowrap">
            <time dateTime={isoDate(article.published_at)}>
              {formatDate(article.published_at)}
            </time>
            <span aria-hidden="true" className="text-fg-faint/50">
              /
            </span>
            <span>{article.reading_minutes} min</span>
            <span aria-hidden="true" className="text-fg-faint/50">
              /
            </span>
            <span>{extra > 0 ? `${extra + 1} fuentes` : article.source_name}</span>
            <span aria-hidden="true" className="text-fg-faint/50">
              /
            </span>
            <span>{formatViews(article.views)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
