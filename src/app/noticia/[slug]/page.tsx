import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBySlug, getRelated } from "@/lib/repo";
import { renderMarkdown } from "@/lib/markdown";
import ArticleCard, { formatDate } from "@/components/ArticleCard";
import { categoryName } from "@/lib/categories";
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

  const related = article.tags.length ? await getRelated(article) : [];
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
    <article className="article">
      <div className="meta">
        <Link href={`/categoria/${article.category}`} className="kicker">
          {categoryName(article.category)}
        </Link>
        <span className="dot">·</span>
        <span>{formatDate(article.published_at)}</span>
        <span className="dot">·</span>
        <span>{article.reading_minutes} min de lectura</span>
      </div>

      <h1>{article.title}</h1>
      {article.dek && <p className="dek">{article.dek}</p>}

      {article.tags.length > 0 && (
        <div className="tags">
          {article.tags.map((t) => (
            <Link key={t} href={`/tema/${encodeURIComponent(t)}`} className="tag">
              {t}
            </Link>
          ))}
        </div>
      )}

      {article.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-img" src={article.image_url} alt="" />
      )}

      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

      <aside className="attribution">
        Basado en la informacion publicada por <strong>{article.source_name}</strong>:{" "}
        <a href={article.source_url} target="_blank" rel="noopener nofollow">
          {article.source_title}
        </a>
        {article.extra_sources?.length > 0 && (
          <>
            <div style={{ marginTop: 10 }}>Otros medios que cubrieron esta noticia:</div>
            <ul>
              {article.extra_sources.map((s) => (
                <li key={s.url}>
                  <strong>{s.name}</strong>:{" "}
                  <a href={s.url} target="_blank" rel="noopener nofollow">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        <span className="note">
          Texto reelaborado por la redaccion de {env.siteName} con asistencia de IA. Los datos y
          declaraciones proceden de las fuentes originales enlazadas.
        </span>
      </aside>

      {related.length > 0 && (
        <>
          <div className="section-title">Relacionado</div>
          <div className="grid">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
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
