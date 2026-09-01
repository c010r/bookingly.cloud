import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";
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
      <SectionTitle>{categoryName(slug)}</SectionTitle>
      {articles.length === 0 ? (
        <div className="my-12 rounded-xl border border-dashed border-line-strong p-16 text-center font-mono text-sm text-fg-faint">
          Todavia no hay noticias publicadas en esta seccion.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
