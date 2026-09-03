import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleGrid from "@/components/ArticleGrid";
import { getByCategory } from "@/lib/repo";
import { CATEGORIES, categoryName, isCategory } from "@/lib/categories";

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
  const seccion = CATEGORIES.find((c) => c.slug === slug);

  return (
    <div className="contenedor pb-20">
      {/* Cabecera de sección moderna */}
      <header className="border-b border-border-subtle py-10 lg:py-14">
        <span className="badge-pill bg-accent/10 text-accent font-bold">
          Sección temática
        </span>
        <h1 className="font-display mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-fg">
          {categoryName(slug)}
        </h1>
        {seccion && (
          <p className="font-serif mt-3 max-w-2xl text-lg text-fg-muted first-letter:uppercase">
            {seccion.hint}.
          </p>
        )}
        <p className="meta mt-5 text-xs text-fg-faint font-mono">
          {articles.length === 1 ? "1 noticia procesada" : `${articles.length} noticias procesadas`}
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="my-20 rounded-2xl border border-border-subtle bg-surface p-12 text-center shadow-xs">
          <p className="font-display text-xl font-bold text-fg">Todavía no hay noticias en esta sección.</p>
        </div>
      ) : (
        <div className="mt-10">
          <ArticleGrid articulos={articles} />
        </div>
      )}
    </div>
  );
}
