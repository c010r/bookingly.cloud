import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getById } from "@/lib/repo";
import { renderMarkdown } from "@/lib/markdown";
import { CATEGORIES } from "@/lib/categories";
import { scoreClass, statusClass } from "@/lib/score";
import AdminBar from "../../AdminBar";
import { deleteArticleAction, saveArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

const CAMPO =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-neon";
const ETIQUETA =
  "mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-fg-faint";

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const { ok } = await searchParams;
  const article = await getById(Number(id));
  if (!article) notFound();

  return (
    <>
      <AdminBar title="Editar articulo" />

      {ok && (
        <p className="mb-5 rounded-lg border border-neon/50 bg-neon/10 px-4 py-3 text-sm text-neon">
          Cambios {decodeURIComponent(ok)}.
        </p>
      )}

      <div className="mb-6 rounded-xl border border-line bg-surface p-4 text-[13.5px] text-fg-muted">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-fg">Original:</strong>
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener nofollow"
            className="text-neon-2 underline underline-offset-2"
          >
            {article.source_title}
          </a>
          <span className="text-fg-faint">— {article.source_name}</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusClass(article.status)}`}>
            {article.status}
          </span>
          {article.quality_score !== null && (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${scoreClass(article.quality_score)}`}>
              calidad {article.quality_score}/100
            </span>
          )}
          <span className="font-mono text-[11px] text-fg-faint">{article.views} vistas</span>
        </div>

        {article.quality_notes && (
          <p className="mt-2 text-xs text-fg-faint">{article.quality_notes}</p>
        )}

        {article.extra_sources.length > 0 && (
          <div className="mt-3 text-xs">
            <strong className="text-fg">Misma noticia en otros medios:</strong>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {article.extra_sources.map((s) => (
                <li key={s.url}>
                  {s.name} —{" "}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="text-neon-2 underline underline-offset-2"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <form action={saveArticleAction} className="space-y-4">
          <input type="hidden" name="id" value={article.id} />

          <div>
            <label htmlFor="title" className={ETIQUETA}>Titular</label>
            <input id="title" name="title" defaultValue={article.title} required className={CAMPO} />
          </div>

          <div>
            <label htmlFor="dek" className={ETIQUETA}>Entradilla</label>
            <input id="dek" name="dek" defaultValue={article.dek ?? ""} className={CAMPO} />
          </div>

          <div>
            <label htmlFor="body_md" className={ETIQUETA}>Cuerpo (markdown)</label>
            <textarea
              id="body_md"
              name="body_md"
              defaultValue={article.body_md}
              required
              className={`${CAMPO} min-h-[24rem] resize-y font-mono text-[13px] leading-relaxed`}
            />
          </div>

          <div>
            <label htmlFor="category" className={ETIQUETA}>Seccion</label>
            <select id="category" name="category" defaultValue={article.category} className={CAMPO}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tags" className={ETIQUETA}>Etiquetas</label>
            <input id="tags" name="tags" defaultValue={article.tags.join(", ")} className={CAMPO} />
            <p className="mt-1 text-[11px] text-fg-faint">
              Separadas por comas. Ya no se muestran, pero alimentan el bloque de relacionadas.
            </p>
          </div>

          <div>
            <label htmlFor="image_url" className={ETIQUETA}>Imagen (URL)</label>
            <input id="image_url" name="image_url" defaultValue={article.image_url ?? ""} className={CAMPO} />
          </div>

          <div>
            <label htmlFor="seo_title" className={ETIQUETA}>SEO · titulo</label>
            <input id="seo_title" name="seo_title" defaultValue={article.seo_title ?? ""} maxLength={70} className={CAMPO} />
          </div>

          <div>
            <label htmlFor="seo_description" className={ETIQUETA}>SEO · descripcion</label>
            <input id="seo_description" name="seo_description" defaultValue={article.seo_description ?? ""} maxLength={160} className={CAMPO} />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-lg border border-line px-4 py-2.5 text-sm transition-colors hover:border-neon hover:text-neon"
            >
              Guardar
            </button>
            <button
              type="submit"
              name="publish"
              value="1"
              className="rounded-lg border border-neon bg-neon px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85"
            >
              Guardar y publicar
            </button>
          </div>
        </form>

        <div>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-fg-faint">
            <span className="text-neon">##</span> Vista previa
          </h2>
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{article.title}</h1>
          {article.dek && <p className="mt-3 text-fg-muted">{article.dek}</p>}
          <div
            className="prose-news mt-5 text-[15px]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body_md) }}
          />

          <form action={deleteArticleAction} className="mt-8">
            <input type="hidden" name="id" value={article.id} />
            <button className="rounded-lg border border-line px-4 py-2 text-[13px] text-danger transition-colors hover:border-danger">
              Eliminar definitivamente
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
