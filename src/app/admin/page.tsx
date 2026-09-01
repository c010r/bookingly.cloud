import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getByStatus, lastRuns, statusCounts, type Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { scoreClass } from "@/lib/score";
import AdminBar from "./AdminBar";
import IngestButton from "./IngestButton";
import { setStatusAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; ok?: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const { estado, ok } = await searchParams;
  const status = (["draft", "published", "rejected"].includes(estado || "")
    ? estado
    : "draft") as Article["status"];

  const [articles, counts, runs] = await Promise.all([
    getByStatus(status, 100),
    statusCounts(),
    lastRuns(3),
  ]);

  const label = { draft: "Borradores", published: "Publicados", rejected: "Descartados" }[status];

  return (
    <>
      <AdminBar title={`Redaccion · ${label}`} />

      {ok && <div className="notice ok">{decodeURIComponent(ok)}</div>}

      <div className="stats">
        <div className="stat">
          <div className="n">{counts.draft ?? 0}</div>
          <div className="l">Borradores</div>
        </div>
        <div className="stat">
          <div className="n">{counts.published ?? 0}</div>
          <div className="l">Publicados</div>
        </div>
        <div className="stat">
          <div className="n">{counts.rejected ?? 0}</div>
          <div className="l">Descartados</div>
        </div>
        <div className="stat" style={{ display: "flex", alignItems: "center" }}>
          <IngestButton />
        </div>
      </div>

      {runs.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", fontFamily: "var(--mono)" }}>
          Ultima ingesta:{" "}
          {runs[0].finished_at
            ? `${runs[0].created} nuevos · ${runs[0].published} publicados solos · ` +
              `${runs[0].duplicates} repetidos entre medios · ${runs[0].skipped} ya conocidos · ` +
              `${runs[0].failed} fallos`
            : "en curso..."}
        </p>
      )}

      {articles.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          No hay articulos en este estado.
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          {articles.map((a) => (
            <div className="row" key={a.id}>
              <div className="grow">
                <h4>
                  <Link href={`/admin/articulo/${a.id}`}>{a.title}</Link>{" "}
                  <span className={`badge badge-${a.status}`}>{a.status}</span>{" "}
                  {a.quality_score !== null && (
                    <span className={`score ${scoreClass(a.quality_score)}`}>
                      {a.quality_score}
                    </span>
                  )}
                  {a.auto_published && (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      auto
                    </span>
                  )}
                </h4>
                <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--text-dim)" }}>
                  {a.dek || excerpt(a.body_md, 150)}
                </p>
                <div className="sub">
                  {categoryName(a.category)} · {a.source_name}
                  {a.extra_sources.length > 0 && ` (+${a.extra_sources.length} medios)`} ·{" "}
                  {a.reading_minutes} min · {a.tags.join(", ") || "sin etiquetas"} ·{" "}
                  <a href={a.source_url} target="_blank" rel="noopener nofollow">
                    original
                  </a>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <Link className="btn" href={`/admin/articulo/${a.id}`}>
                  Editar
                </Link>
                {a.status !== "published" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="published" />
                    <button className="btn btn-primary" type="submit">
                      Publicar
                    </button>
                  </form>
                )}
                {a.status === "published" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="draft" />
                    <button className="btn" type="submit">
                      Despublicar
                    </button>
                  </form>
                )}
                {a.status !== "rejected" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="btn btn-danger" type="submit">
                      Descartar
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
