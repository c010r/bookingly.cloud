import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getByStatus, lastRuns, statusCounts, type Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { scoreClass, statusClass } from "@/lib/score";
import AdminBar from "./AdminBar";
import IngestButton from "./IngestButton";
import { setStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const ETIQUETAS = { draft: "Borradores", published: "Publicados", rejected: "Descartados" };

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
    lastRuns(1),
  ]);

  return (
    <>
      <AdminBar title={`Redaccion · ${ETIQUETAS[status]}`} />

      {ok && (
        <p className="mb-5 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
          {decodeURIComponent(ok)}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {(["draft", "published", "rejected"] as const).map((s) => (
          <div key={s} className="min-w-28 rounded-xl border border-line bg-surface px-5 py-3.5">
            <div className="font-mono text-2xl font-semibold tabular-nums">{counts[s] ?? 0}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-faint">
              {ETIQUETAS[s]}
            </div>
          </div>
        ))}
        <IngestButton />
      </div>

      {runs[0] && (
        <p className="mb-6 font-mono text-xs text-fg-faint">
          Ultima ingesta:{" "}
          {runs[0].finished_at
            ? `${runs[0].created} nuevos · ${runs[0].published} publicados · ${runs[0].duplicates} repetidos · ${runs[0].skipped} ya conocidos · ${runs[0].failed} fallos`
            : "en curso..."}
        </p>
      )}

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-16 text-center font-mono text-sm text-fg-faint">
          No hay articulos en este estado.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {articles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start gap-4 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 flex flex-wrap items-center gap-2 text-[15.5px] leading-snug font-semibold">
                  <Link href={`/admin/articulo/${a.id}`} className="hover:text-accent">
                    {a.title}
                  </Link>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusClass(a.status)}`}
                  >
                    {a.status}
                  </span>
                  {a.quality_score !== null && (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${scoreClass(a.quality_score)}`}
                    >
                      {a.quality_score}
                    </span>
                  )}
                  {a.auto_published && (
                    <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-fg-faint">
                      auto
                    </span>
                  )}
                </h3>

                <p className="mb-2 text-[13.5px] leading-relaxed text-fg-muted">
                  {a.dek || excerpt(a.body_md, 150)}
                </p>

                <div className="font-mono text-[11.5px] text-fg-faint">
                  {categoryName(a.category)} · {a.source_name}
                  {a.extra_sources.length > 0 && ` (+${a.extra_sources.length})`} ·{" "}
                  {a.views} vistas ·{" "}
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="text-accent underline underline-offset-2"
                  >
                    original
                  </a>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/admin/articulo/${a.id}`}
                  className="rounded-lg border border-line px-3.5 py-2 text-[13px] transition-colors hover:border-accent hover:text-accent"
                >
                  Editar
                </Link>
                {a.status !== "published" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="published" />
                    <button className="rounded-lg border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-85">
                      Publicar
                    </button>
                  </form>
                )}
                {a.status === "published" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="draft" />
                    <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] transition-colors hover:border-fg-muted">
                      Despublicar
                    </button>
                  </form>
                )}
                {a.status !== "rejected" && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-danger transition-colors hover:border-danger">
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
