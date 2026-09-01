import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listSourcesWithCounts } from "@/lib/repo";
import AdminBar from "../AdminBar";
import { addSourceAction, removeSourceAction, toggleSourceAction } from "../actions";

export const dynamic = "force-dynamic";

const CAMPO =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-neon";
const ETIQUETA = "mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-fg-faint";

export default async function SourcesPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");
  const sources = await listSourcesWithCounts();
  const activas = sources.filter((s) => s.active).length;

  return (
    <>
      <AdminBar title={`Fuentes RSS · ${activas} activas de ${sources.length}`} />

      <form
        action={addSourceAction}
        className="mb-8 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
      >
        <div>
          <label htmlFor="name" className={ETIQUETA}>Nombre</label>
          <input id="name" name="name" required placeholder="Ars Technica" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="feed_url" className={ETIQUETA}>URL del feed</label>
          <input id="feed_url" name="feed_url" required type="url" placeholder="https://.../feed" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="site_url" className={ETIQUETA}>Web</label>
          <input id="site_url" name="site_url" type="url" placeholder="https://..." className={CAMPO} />
        </div>
        <div>
          <label htmlFor="lang" className={ETIQUETA}>Idioma</label>
          <select id="lang" name="lang" defaultValue="en" className={CAMPO}>
            <option value="en">en</option>
            <option value="es">es</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-neon bg-neon px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85"
        >
          Anadir
        </button>
      </form>

      {sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-16 text-center font-mono text-sm text-fg-faint">
          No hay fuentes. Ejecuta <code className="text-neon">npm run db:seed</code>.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                  {s.name}
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                      s.active
                        ? "border-neon/50 bg-neon/10 text-neon"
                        : "border-line bg-surface-2 text-fg-faint"
                    }`}
                  >
                    {s.active ? "activa" : "pausada"}
                  </span>
                </h3>
                <p className="mt-1 truncate font-mono text-[11.5px] text-fg-faint">
                  {s.feed_url} · {s.lang} · {s.article_count} articulos
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={toggleSourceAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] transition-colors hover:border-neon hover:text-neon">
                    {s.active ? "Pausar" : "Activar"}
                  </button>
                </form>
                <form action={removeSourceAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-danger transition-colors hover:border-danger">
                    Borrar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
