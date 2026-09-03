import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBySlug, getRelated } from "@/lib/repo";
import { renderMarkdown, empiezaConSigla } from "@/lib/markdown";
import ArticleGrid from "@/components/ArticleGrid";
import SectionTitle from "@/components/SectionTitle";
import ViewCounter from "@/components/ViewCounter";
import ReadingProgress from "@/components/ReadingProgress";
import ReadingActionBar from "@/components/ReadingActionBar";
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
    <article className="pb-20">
      <ReadingProgress />
      <ViewCounter slug={article.slug} />

      {/* Entrada editorial */}
      <header className="contenedor pt-10 pb-8 lg:pt-14">
        <div className="mx-auto max-w-[54rem]">
          <Link
            href={`/categoria/${article.category}`}
            className="badge-pill bg-accent text-accent-fg font-bold tracking-wide transition-opacity hover:opacity-90"
          >
            {categoryName(article.category)}
          </Link>

          <h1 className="font-display mt-4 text-3xl sm:text-4xl lg:text-[3.25rem] font-black leading-[1.04] tracking-tight text-fg">
            {article.title}
          </h1>

          {article.dek && (
            <p className="font-serif mt-5 max-w-[46rem] text-lg sm:text-xl text-fg-muted leading-relaxed">
              {article.dek}
            </p>
          )}

          <div className="meta mt-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-subtle pt-4 text-xs text-fg-faint">
            <time dateTime={isoDate(article.published_at)}>
              {formatDate(article.published_at)}
            </time>
            <span aria-hidden="true">/</span>
            <span>{article.reading_minutes} min de lectura</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-fg-muted">
              {extra > 0 ? `${extra + 1} fuentes contrastadas` : article.source_name}
            </span>
            <span aria-hidden="true">/</span>
            <span>{formatViews(article.views)}</span>
          </div>
        </div>
      </header>

      {/* Imagen de apertura con estética moderna */}
      {article.image_url && (
        <figure className="contenedor mb-12">
          <div className="mx-auto max-w-[54rem] overflow-hidden rounded-2xl border border-border-subtle bg-surface-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="no-referrer"
              src={article.image_url}
              alt=""
              className="max-h-[65vh] w-full object-cover"
            />
          </div>
        </figure>
      )}

      <div className="contenedor">
        <div
          className={`prose-news mx-auto max-w-[42rem]${empiezaConSigla(article.body_md) ? " sin-capitular" : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Transparencia Algorítmica & Fuentes */}
        <aside
          id="fuentes"
          className="mx-auto mt-14 max-w-[42rem] rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-xs"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <p className="font-sans text-xs font-bold uppercase tracking-wider text-fg">
                Transparencia & Fuentes Originales
              </p>
            </div>
            {article.quality_score && (
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-accent font-mono">
                Índice de Calidad: {article.quality_score}/100
              </span>
            )}
          </div>

          <p className="font-serif mt-4 text-[0.95rem] leading-relaxed text-fg-muted">
            {article.source_author ? (
              <>
                Basado originalmente en la cobertura de{" "}
                <strong className="font-semibold text-fg font-sans">{article.source_author}</strong> para{" "}
                <strong className="font-semibold text-fg font-sans">{article.source_name}</strong>:{" "}
              </>
            ) : (
              <>
                Basado en el despacho informativo publicado por{" "}
                <strong className="font-semibold text-fg font-sans">{article.source_name}</strong>:{" "}
              </>
            )}
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener nofollow"
              className="inline-block text-accent font-sans font-medium underline underline-offset-4 hover:opacity-80"
            >
              &ldquo;{article.source_title}&rdquo; ↗
            </a>
          </p>

          {extra > 0 && (
            <div className="mt-5 border-t border-line/60 pt-3.5">
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-fg-faint mb-2">
                Medios adicionales detectados y contrastados:
              </p>
              <ul className="space-y-2">
                {article.extra_sources.map((s) => (
                  <li key={s.url} className="flex items-baseline gap-2 text-xs text-fg-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <strong className="font-semibold text-fg font-sans">{s.name}:</strong>{" "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener nofollow"
                      className="text-fg-muted hover:text-accent underline underline-offset-2 truncate"
                    >
                      {s.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-xl bg-bg-soft/70 p-3 text-[0.72rem] text-fg-faint font-sans">
            Curaduría y síntesis autónoma realizada por la redacción algorítmica de {env.siteName}. Los hechos y citas textuales provienen de las fuentes originales acreditadas.
          </div>
        </aside>

        {related.length > 0 && (
          <div className="mt-16">
            <SectionTitle>Historias Relacionadas</SectionTitle>
            <ArticleGrid articulos={related} amplias={0} permitirCambioVista={false} />
          </div>
        )}
      </div>

      <ReadingActionBar
        slug={article.slug}
        title={article.title}
        readingMinutes={article.reading_minutes}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
}
