import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import { countPublished, getPublished, getTopTags } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 13;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [articles, total, tags] = await Promise.all([
    getPublished(PAGE_SIZE, offset),
    countPublished(),
    getTopTags(10),
  ]);

  if (articles.length === 0) {
    return (
      <div className="empty" style={{ marginTop: 60 }}>
        <p>Todavia no hay noticias publicadas.</p>
        <p style={{ fontSize: 13 }}>
          Lanza una ingesta con <code>npm run ingest</code> y aprueba los borradores desde el{" "}
          <Link href="/admin" style={{ color: "var(--accent)" }}>
            panel
          </Link>
          .
        </p>
      </div>
    );
  }

  const [lead, ...rest] = articles;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {tags.length > 0 && (
        <>
          <div className="section-title">Temas</div>
          <div className="tags">
            {tags.map((t) => (
              <Link key={t.tag} href={`/tema/${encodeURIComponent(t.tag)}`} className="tag">
                {t.tag} <span style={{ opacity: 0.5 }}>{t.n}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-title">{page === 1 ? "Ultimo" : `Pagina ${page}`}</div>
      <div className="grid">
        {page === 1 && <ArticleCard article={lead} featured />}
        {(page === 1 ? rest : articles).map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>

      {lastPage > 1 && (
        <div className="pager">
          {page > 1 && (
            <Link className="btn" href={page === 2 ? "/" : `/?p=${page - 1}`}>
              ← Anterior
            </Link>
          )}
          <span className="btn" style={{ cursor: "default" }}>
            {page} / {lastPage}
          </span>
          {page < lastPage && (
            <Link className="btn" href={`/?p=${page + 1}`}>
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
