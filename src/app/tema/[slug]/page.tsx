import type { Metadata } from "next";
import ArticleCard from "@/components/ArticleCard";
import { getByTag } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  return { title: `Tema: ${tag}`, description: `Noticias de tecnologia sobre ${tag}.` };
}

export default async function TagPage({ params }: Params) {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  const articles = await getByTag(tag);

  return (
    <>
      <div className="section-title">Tema · {tag}</div>
      {articles.length === 0 ? (
        <div className="empty">No hay noticias publicadas con esta etiqueta.</div>
      ) : (
        <div className="grid">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </>
  );
}
