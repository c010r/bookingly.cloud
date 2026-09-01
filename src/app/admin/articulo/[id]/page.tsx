import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getById } from "@/lib/repo";
import { renderMarkdown } from "@/lib/markdown";
import { CATEGORIES } from "@/lib/categories";
import { scoreClass } from "@/lib/score";
import AdminBar from "../../AdminBar";
import { deleteArticleAction, saveArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

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

      {ok && <div className="notice ok">Cambios {decodeURIComponent(ok)}.</div>}

      <div className="notice">
        <strong>Original:</strong>{" "}
        <a href={article.source_url} target="_blank" rel="noopener nofollow">
          {article.source_title}
        </a>{" "}
        — {article.source_name}
        {article.model ? ` · reescrito con ${article.model}` : ""} ·{" "}
        <span className={`badge badge-${article.status}`}>{article.status}</span>
        {article.quality_score !== null && (
          <>
            {" "}
            <span className={`score ${scoreClass(article.quality_score)}`}>
              calidad {article.quality_score}/100
            </span>
            {article.auto_published && " · publicado automaticamente"}
          </>
        )}
        {article.quality_notes && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-faint)" }}>
            {article.quality_notes}
          </div>
        )}
        {article.extra_sources.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            <strong>Misma noticia en otros medios:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {article.extra_sources.map((s) => (
                <li key={s.url}>
                  {s.name} —{" "}
                  <a href={s.url} target="_blank" rel="noopener nofollow">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,0.85fr)", gap: 28 }}>
        <form action={saveArticleAction}>
          <input type="hidden" name="id" value={article.id} />

          <div className="field">
            <label htmlFor="title">Titular</label>
            <input id="title" name="title" defaultValue={article.title} required />
          </div>

          <div className="field">
            <label htmlFor="dek">Entradilla</label>
            <input id="dek" name="dek" defaultValue={article.dek ?? ""} />
          </div>

          <div className="field">
            <label htmlFor="body_md">Cuerpo (markdown)</label>
            <textarea id="body_md" name="body_md" defaultValue={article.body_md} required />
          </div>

          <div className="field">
            <label htmlFor="category">Seccion</label>
            <select id="category" name="category" defaultValue={article.category}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tags">Etiquetas</label>
            <input id="tags" name="tags" defaultValue={article.tags.join(", ")} />
            <span className="hint">Separadas por comas, maximo 8.</span>
          </div>

          <div className="field">
            <label htmlFor="image_url">Imagen (URL)</label>
            <input id="image_url" name="image_url" defaultValue={article.image_url ?? ""} />
          </div>

          <div className="field">
            <label htmlFor="seo_title">SEO · titulo</label>
            <input id="seo_title" name="seo_title" defaultValue={article.seo_title ?? ""} maxLength={70} />
          </div>

          <div className="field">
            <label htmlFor="seo_description">SEO · descripcion</label>
            <input
              id="seo_description"
              name="seo_description"
              defaultValue={article.seo_description ?? ""}
              maxLength={160}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="submit">
              Guardar
            </button>
            <button className="btn btn-primary" type="submit" name="publish" value="1">
              Guardar y publicar
            </button>
          </div>
        </form>

        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Vista previa
          </div>
          <div className="article" style={{ padding: 0 }}>
            <h1 style={{ fontSize: 26 }}>{article.title}</h1>
            {article.dek && <p className="dek" style={{ fontSize: 16 }}>{article.dek}</p>}
            <div
              className="prose"
              style={{ fontSize: 15 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body_md) }}
            />
          </div>

          <form action={deleteArticleAction} style={{ marginTop: 30 }}>
            <input type="hidden" name="id" value={article.id} />
            <button className="btn btn-danger" type="submit">
              Eliminar definitivamente
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
