import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import { getByCategory } from "@/lib/repo";
import { categoryName, isCategory } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) return { title: "Seccion no encontrada" };
  const name = categoryName(slug);
  return { title: name, description: `Ultimas noticias de ${name.toLowerCase()}.` };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  if (!isCategory(slug)) notFound();

  const articles = await getByCategory(slug);

  return (
    <>
      <div className="section-title">{categoryName(slug)}</div>
      {articles.length === 0 ? (
        <div className="empty">Todavia no hay noticias publicadas en esta seccion.</div>
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
