import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listSourcesWithCounts } from "@/lib/repo";
import AdminBar from "../AdminBar";
import { addSourceAction, removeSourceAction, toggleSourceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");
  const sources = await listSourcesWithCounts();

  return (
    <>
      <AdminBar title="Fuentes RSS" />

      <form
        action={addSourceAction}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr)) auto", gap: 12, alignItems: "end", marginBottom: 30 }}
      >
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="name">Nombre</label>
          <input id="name" name="name" required placeholder="Ars Technica" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="feed_url">URL del feed</label>
          <input id="feed_url" name="feed_url" required type="url" placeholder="https://.../feed" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="site_url">Web</label>
          <input id="site_url" name="site_url" type="url" placeholder="https://..." />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="lang">Idioma</label>
          <select id="lang" name="lang" defaultValue="en">
            <option value="en">en</option>
            <option value="es">es</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit">
          Anadir
        </button>
      </form>

      {sources.length === 0 ? (
        <div className="empty">
          No hay fuentes. Ejecuta <code>npm run db:seed</code> para cargar un set inicial.
        </div>
      ) : (
        sources.map((s) => (
          <div className="row" key={s.id}>
            <div className="grow">
              <h4>
                {s.name}{" "}
                <span className={`badge ${s.active ? "badge-published" : "badge-rejected"}`}>
                  {s.active ? "activa" : "pausada"}
                </span>
              </h4>
              <div className="sub">
                {s.feed_url} · {s.lang} · {s.article_count} articulos
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <form action={toggleSourceAction}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn" type="submit">
                  {s.active ? "Pausar" : "Activar"}
                </button>
              </form>
              <form action={removeSourceAction}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn btn-danger" type="submit">
                  Borrar
                </button>
              </form>
            </div>
          </div>
        ))
      )}
    </>
  );
}
