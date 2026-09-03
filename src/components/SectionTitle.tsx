/**
 * Cabecera de bloque: palabra en negra alta sobre un filete grueso. Es el
 * unico separador de la portada, asi que carga con toda la jerarquia.
 */
export default function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-14 mb-8 flex items-center justify-between border-b border-border-subtle pb-3">
      <h2 className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
        <span className="font-display text-lg sm:text-xl font-black tracking-tight uppercase text-fg">
          {children}
        </span>
      </h2>
    </div>
  );
}
