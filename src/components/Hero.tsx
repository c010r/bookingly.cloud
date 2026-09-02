import Link from "next/link";
import type { Article } from "@/lib/repo";
import HeroCarousel from "./HeroCarousel";
import { formatRelative, formatViews } from "@/lib/format";

/**
 * Apertura de la portada: la seleccion destacada a sangre y, debajo, dos
 * indices tipograficos — lo ultimo en entrar y lo mas leido de la semana.
 */
export default function Hero({
  destacadas,
  recientes,
  masLeidas,
}: {
  destacadas: Article[];
  recientes: Article[];
  masLeidas: Article[];
}) {
  return (
    <>
      <section aria-label="Destacadas" className="border-b-2 border-fg">
        <HeroCarousel articulos={destacadas} />
      </section>

      <div className="contenedor">
        <div className="grid border-b-2 border-fg lg:grid-cols-2">
          <Indice titulo="Recien llegadas" className="lg:border-r lg:border-line lg:pr-10">
            <ol className="divide-y divide-line">
              {recientes.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/noticia/${a.slug}`}
                    className="grupo-pieza group flex gap-4 py-3.5"
                  >
                    <span className="meta w-14 shrink-0 pt-0.5 font-bold text-accent">
                      {formatRelative(a.published_at)}
                    </span>
                    <span className="enlace-titular titular-s flex-1">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Indice>

          <Indice titulo="Mas leidas" className="lg:pl-10">
            <ol className="divide-y divide-line">
              {masLeidas.map((a, i) => (
                <li key={a.id}>
                  <Link
                    href={`/noticia/${a.slug}`}
                    className="grupo-pieza group flex items-start gap-4 py-3.5"
                  >
                    <span
                      className={`numeral w-12 shrink-0 text-[2.1rem] ${
                        i === 0 ? "text-accent" : "text-fg-faint/45"
                      }`}
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">
                      <span className="enlace-titular titular-s block">{a.title}</span>
                      <span className="meta mt-1 block text-fg-faint">
                        {formatViews(a.views)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Indice>
        </div>
      </div>
    </>
  );
}

function Indice({
  titulo,
  className = "",
  children,
}: {
  titulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`py-9 ${className}`}>
      <h2 className="etiqueta mb-4 flex items-center gap-2.5 border-b border-fg pb-2.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 bg-accent" />
        {titulo}
      </h2>
      {children}
    </section>
  );
}
