import Link from "next/link";
import { countPublished } from "@/lib/repo";
import TeclaAtajo from "./TeclaAtajo";

export default async function LiveRadarBar() {
  let totalNoticias = 0;
  try {
    totalNoticias = await countPublished();
  } catch {
    totalNoticias = 0;
  }

  return (
    <div className="border-b border-border-subtle bg-bg-soft/70 px-4 py-1.5 text-xs">
      <div className="contenedor flex items-center justify-between gap-4">
        {/* Lado izquierdo: radar en vivo con indicador de pulso */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="pulso-radar absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <p className="truncate font-sans font-medium text-fg-muted tracking-tight text-[0.72rem]">
            <span className="font-bold text-fg">RADAR Bookingly:</span>{" "}
            <span className="hidden sm:inline">Monitoreo continuo de 45 fuentes tech</span>
            <span className="mx-2 text-fg-faint/40 hidden sm:inline">/</span>
            <span>{totalNoticias} noticias analizadas con IA</span>
          </p>
        </div>

        {/* Lado derecho: atajo de búsqueda y enlace directo */}
        <div className="flex shrink-0 items-center gap-3 text-fg-faint text-[0.72rem]">
          <span className="hidden md:inline font-mono">
            Presiona <TeclaAtajo className="rounded border border-line bg-surface px-1 py-0.5 text-[0.65rem] font-semibold text-fg shadow-xs" /> para buscar
          </span>
          <Link
            href="/feed.xml"
            className="hidden sm:inline font-medium hover:text-accent transition-colors"
            title="Suscripción RSS"
          >
            RSS
          </Link>
        </div>
      </div>
    </div>
  );
}
