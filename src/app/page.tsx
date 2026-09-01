import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
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
    getPublished(PAGE_SIZE, offset),
    countPublished(),
    primera ? getRecentlyUpdated(5) : Promise.resolve([]),
    primera ? getMostRead(5) : Promise.resolve([]),
  ]);

  if (articles.length === 0) {
    return (
      <div className="my-20 rounded-xl border border-dashed border-line-strong p-16 text-center text-fg-faint">
        <p className="font-mono text-sm">Todavia no hay noticias publicadas.</p>
        <p className="mt-2 text-[13px]">
          La ingesta corre sola cada 30 minutos; tambien puedes lanzarla desde el{" "}
          <Link href="/admin" className="text-neon underline underline-offset-4">
            panel
          </Link>
          .
        </p>
      </div>
    );
  }

  // En la primera pagina la noticia principal se muestra en el hero, asi que
  // no debe repetirse mas abajo en la rejilla.
  const [principal, ...resto] = articles;
  const rejilla = primera ? resto : articles;
  const ultimaPagina = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {primera && (
        <Hero principal={principal} recientes={recientes} masLeidas={masLeidas} />
      )}

      <SectionTitle>{primera ? "Ultimas noticias" : `Pagina ${page}`}</SectionTitle>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rejilla.map((a, i) => (
          <ArticleCard key={a.id} article={a} index={i} />
        ))}
      </div>

      {ultimaPagina > 1 && (
        <nav className="mt-14 flex items-center justify-center gap-3 font-mono text-[13px]">
          {page > 1 && (
            <Link
              href={page === 2 ? "/" : `/?p=${page - 1}`}
              className="rounded-lg border border-line px-4 py-2 text-fg-muted transition-colors hover:border-neon hover:text-neon"
            >
              ← Anterior
            </Link>
          )}
          <span className="px-2 text-fg-faint tabular-nums">
            {page} / {ultimaPagina}
          </span>
          {page < ultimaPagina && (
            <Link
              href={`/?p=${page + 1}`}
              className="rounded-lg border border-line px-4 py-2 text-fg-muted transition-colors hover:border-neon hover:text-neon"
            >
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
