/**
 * Cabecera de bloque: palabra en negra alta sobre un filete grueso. Es el
 * unico separador de la portada, asi que carga con toda la jerarquia.
 */
export default function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-16 mb-9 border-b-2 border-fg pb-3">
      <h2 className="flex items-center gap-3">
        <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 bg-accent" />
        <span className="font-display text-[1.35rem] leading-none font-black tracking-[-0.02em] uppercase sm:text-[1.65rem]">
          {children}
        </span>
      </h2>
    </div>
  );
}
