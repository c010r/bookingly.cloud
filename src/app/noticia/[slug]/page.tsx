import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBySlug, getRelated } from "@/lib/repo";
import { renderMarkdown, empiezaConSigla } from "@/lib/markdown";
import ArticleGrid from "@/components/ArticleGrid";
import SectionTitle from "@/components/SectionTitle";
import ViewCounter from "@/components/ViewCounter";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews, isoDate } from "@/lib/format";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getBySlug(slug);
  if (!article) return { title: "Noticia no encontrada" };

  return {
    title: article.seo_title || article.title,
    description: article.seo_description || article.dek || undefined,
    alternates: { canonical: `${env.siteUrl}/noticia/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.seo_title || article.title,
      description: article.seo_description || article.dek || undefined,
      publishedTime: article.published_at?.toISOString(),
      images: article.image_url ? [article.image_url] : undefined,
      tags: article.tags,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getBySlug(slug);
  if (!article) notFound();

  const related = await getRelated(article);
  const html = renderMarkdown(article.body_md);
  const extra = article.extra_sources?.length ?? 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seo_description || article.dek || undefined,
    articleSection: categoryName(article.category),
    keywords: article.tags.join(", "),
    datePublished: article.published_at?.toISOString(),
    dateModified: article.updated_at?.toISOString(),
    image: article.image_url ? [article.image_url] : undefined,
    publisher: { "@type": "Organization", name: env.siteName },
    citation: { "@type": "CreativeWork", name: article.source_title, url: article.source_url },
  };

  return (
    <article>
      <ViewCounter slug={article.slug} />

      {/* Entrada: el titular manda y ocupa una columna mas ancha que el texto. */}
      <header className="contenedor pt-12 pb-9 lg:pt-16">
        <div className="mx-auto max-w-[54rem]">
          <Link
            href={`/categoria/${article.category}`}
            className="etiqueta inline-block bg-accent px-2 py-1 text-accent-fg transition-opacity hover:opacity-80"
          >
            {categoryName(article.category)}
          </Link>

          <h1 className="titular-xl mt-5">{article.title}</h1>

          {article.dek && (
            <p className="entradilla mt-6 max-w-[44rem] text-xl text-fg-muted sm:text-[1.4rem]">
              {article.dek}
            </p>
          )}

          <div className="meta mt-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t-2 border-fg pt-3.5 text-fg-faint">
            <time dateTime={isoDate(article.published_at)}>
              {formatDate(article.published_at)}
            </time>
            <span aria-hidden="true" className="text-fg-faint/50">
              /
            </span>
            <span>{article.reading_minutes} min de lectura</span>
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
      </header>

      {/* Imagen de apertura a sangre: de borde a borde de la ventana. */}
      {article.image_url && (
        <figure className="mb-10 border-y-2 border-fg bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            // Varios CDN devuelven 403 si el referer es otro dominio; sin el sirven igual.
            referrerPolicy="no-referrer"
            src={article.image_url}
            alt=""
            className="max-h-[72vh] w-full object-cover"
          />
        </figure>
      )}

      <div className="contenedor">
        <div
          className={`prose-news mx-auto max-w-[42rem]${empiezaConSigla(article.body_md) ? " sin-capitular" : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Procedencia: bloque de credito, con filete grueso arriba. */}
        <aside className="mx-auto mt-14 max-w-[42rem] border-t-2 border-fg pt-5">
          <p className="etiqueta text-accent">Fuentes</p>
          <p className="entradilla mt-3 text-[0.95rem] leading-relaxed text-fg-muted">
            {article.source_author ? (
              <>
                Basado en el articulo de{" "}
                <strong className="font-semibold text-fg">{article.source_author}</strong> en{" "}
                <strong className="font-semibold text-fg">{article.source_name}</strong>:{" "}
              </>
            ) : (
              <>
                Basado en la informacion publicada por{" "}
                <strong className="font-semibold text-fg">{article.source_name}</strong>:{" "}
              </>
            )}
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener nofollow"
              className="text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
            >
              {article.source_title}
            </a>
          </p>

          {extra > 0 && (
            <>
              <p className="entradilla mt-4 mb-1.5 text-[0.95rem] text-fg-muted">
                Otros medios que cubrieron esta noticia:
              </p>
              <ul className="entradilla space-y-1.5 text-[0.95rem] text-fg-muted">
                {article.extra_sources.map((s) => (
                  <li key={s.url} className="border-l-2 border-line pl-3">
                    <strong className="font-semibold text-fg">{s.name}</strong>:{" "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener nofollow"
                      className="text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="meta mt-5 text-fg-faint">
            Texto reelaborado por la redaccion de {env.siteName}. Los datos y declaraciones
            proceden de las fuentes originales enlazadas.
          </p>
        </aside>

        {related.length > 0 && (
          <>
            <SectionTitle>Relacionado</SectionTitle>
            <ArticleGrid articulos={related} amplias={0} />
          </>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
}
