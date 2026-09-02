import Link from "next/link";
import ArticleGrid from "@/components/ArticleGrid";
import Hero from "@/components/Hero";
import SectionTitle from "@/components/SectionTitle";
import {
  countPublished,
  getMostRead,
  getPublished,
  getRecentlyUpdated,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 12;
/** Noticias que rotan en el carrusel de portada. */
const DESTACADAS = 5;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const primera = page === 1;
  const offset = (page - 1) * PAGE_SIZE;

  const [articles, total, recientes, masLeidas] = await Promise.all([
    getPublished(primera ? PAGE_SIZE + DESTACADAS : PAGE_SIZE, offset),
    countPublished(),
    primera ? getRecentlyUpdated(5) : Promise.resolve([]),
    primera ? getMostRead(5) : Promise.resolve([]),
  ]);

  if (articles.length === 0) {
    return (
      <div className="contenedor">
        <div className="my-24 border-y-2 border-fg py-20 text-center">
          <p className="titular-l">Todavia no hay noticias publicadas.</p>
          <p className="entradilla mx-auto mt-4 max-w-md text-fg-muted">
            La ingesta corre sola cada 30 minutos; tambien puedes lanzarla desde el{" "}
            <Link
              href="/admin"
              className="text-fg underline decoration-accent decoration-2 underline-offset-4"
            >
              panel
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // En la primera pagina las destacadas van en el carrusel, asi que no deben
  // repetirse mas abajo en la rejilla.
  const destacadas = primera ? articles.slice(0, DESTACADAS) : [];
  const rejilla = primera ? articles.slice(DESTACADAS) : articles;
  const ultimaPagina = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {primera && destacadas.length > 0 && (
        <Hero destacadas={destacadas} recientes={recientes} masLeidas={masLeidas} />
      )}

      <div className="contenedor">
        <SectionTitle>{primera ? "Ultimas noticias" : `Pagina ${page}`}</SectionTitle>
        <ArticleGrid articulos={rejilla} />

        {ultimaPagina > 1 && (
          <nav
            aria-label="Paginacion"
            className="mt-20 flex items-center justify-between gap-4 border-t-2 border-fg pt-5"
          >
            <div className="flex-1">
              {page > 1 && (
                <Link
                  href={page === 2 ? "/" : `/?p=${page - 1}`}
                  className="etiqueta inline-block border-2 border-fg px-4 py-2.5 transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg"
                >
                  &#8592; Anterior
                </Link>
              )}
            </div>
            <span className="numeral shrink-0 text-[1.4rem] text-fg-faint">
              {page} / {ultimaPagina}
            </span>
            <div className="flex flex-1 justify-end">
              {page < ultimaPagina && (
                <Link
                  href={`/?p=${page + 1}`}
                  className="etiqueta inline-block border-2 border-fg px-4 py-2.5 transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg"
                >
                  Siguiente &#8594;
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
