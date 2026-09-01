import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBySlug, getRelated } from "@/lib/repo";
import { renderMarkdown } from "@/lib/markdown";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";
import ViewCounter from "@/components/ViewCounter";
import { categoryName } from "@/lib/categories";
import { formatDate } from "@/lib/format";
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
    <article className="mx-auto max-w-[46rem] py-12">
      <ViewCounter slug={article.slug} />

      <div className="mb-4 flex flex-wrap items-center gap-2.5 font-mono text-[11.5px] text-fg-faint">
        <Link
          href={`/categoria/${article.category}`}
          className="font-semibold uppercase tracking-[0.14em] text-neon transition-opacity hover:opacity-75"
        >
          {categoryName(article.category)}
        </Link>
        <span className="opacity-40">·</span>
        <time>{formatDate(article.published_at)}</time>
        <span className="opacity-40">·</span>
        <span>{article.reading_minutes} min de lectura</span>
      </div>

      <h1 className="text-3xl leading-[1.12] font-bold tracking-tight text-balance sm:text-[2.7rem]">
        {article.title}
      </h1>

      {article.dek && (
        <p className="mt-5 text-lg leading-relaxed text-fg-muted sm:text-xl">{article.dek}</p>
      )}

      {article.image_url && (
        <div className="my-8 overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image_url} alt="" className="w-full" />
        </div>
      )}

      <div className="prose-news mt-8" dangerouslySetInnerHTML={{ __html: html }} />

      <aside className="mt-12 rounded-xl border border-line border-l-2 border-l-neon bg-surface p-5 text-[13.5px] leading-relaxed text-fg-muted">
        Basado en la informacion publicada por <strong className="text-fg">{article.source_name}</strong>:{" "}
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener nofollow"
          className="text-neon-2 underline underline-offset-4"
        >
          {article.source_title}
        </a>
        {article.extra_sources?.length > 0 && (
          <>
            <p className="mt-3 mb-1">Otros medios que cubrieron esta noticia:</p>
            <ul className="list-disc space-y-1 pl-5">
              {article.extra_sources.map((s) => (
                <li key={s.url}>
                  <strong className="text-fg">{s.name}</strong>:{" "}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="text-neon-2 underline underline-offset-4"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        <span className="mt-3 block text-xs text-fg-faint">
          Texto reelaborado por la redaccion de {env.siteName}. Los datos y declaraciones proceden
          de las fuentes originales enlazadas.
        </span>
      </aside>

      {related.length > 0 && (
        <>
          <SectionTitle>Relacionado</SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            {related.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </div>
        </>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
}
