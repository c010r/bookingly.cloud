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
    <div className="contenedor">
      {/* Cabecera de seccion: el nombre a cuerpo de cartel abre la pagina. */}
      <header className="border-b-2 border-fg py-12 lg:py-16">
        <p className="etiqueta text-accent">Seccion</p>
        <h1 className="titular-xl mt-3">{categoryName(slug)}</h1>
        {seccion && (
          <p className="entradilla mt-4 max-w-2xl text-lg text-fg-muted first-letter:uppercase">
            {seccion.hint}.
          </p>
        )}
        <p className="meta mt-6 text-fg-faint">
          {articles.length === 1 ? "1 noticia" : `${articles.length} noticias`}
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="my-24 border-b-2 border-fg pb-20 text-center">
          <p className="titular-l">Todavia no hay noticias en esta seccion.</p>
        </div>
      ) : (
        <div className="mt-12">
          <ArticleGrid articulos={articles} />
        </div>
      )}
    </div>
  );
}
