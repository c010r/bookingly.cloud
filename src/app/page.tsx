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
        <div className="my-20 rounded-2xl border border-border-subtle bg-surface p-12 text-center shadow-xs">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-accent">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="font-display text-xl font-bold text-fg">Todavía no hay noticias publicadas.</p>
          <p className="entradilla mx-auto mt-3 max-w-md text-sm text-fg-muted">
            La ingesta corre sola cada 30 minutos; también puedes lanzarla desde el{" "}
            <Link
              href="/admin"
              className="text-accent underline underline-offset-4 font-sans font-semibold"
            >
              panel de control
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

      <div className="contenedor pb-16">
        <SectionTitle>{primera ? "Últimas noticias" : `Página ${page}`}</SectionTitle>
        <ArticleGrid articulos={rejilla} />

        {ultimaPagina > 1 && (
          <nav
            aria-label="Paginacion"
            className="mt-16 flex items-center justify-between gap-4 border-t border-border-subtle pt-6"
          >
            <div className="flex-1">
              {page > 1 && (
                <Link
                  href={page === 2 ? "/" : `/?p=${page - 1}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-accent-fg shadow-xs"
                >
                  &#8592; Anterior
                </Link>
              )}
            </div>
            <span className="font-mono text-xs font-semibold text-fg-faint">
              Página {page} de {ultimaPagina}
            </span>
            <div className="flex flex-1 justify-end">
              {page < ultimaPagina && (
                <Link
                  href={`/?p=${page + 1}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-accent-fg shadow-xs"
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
