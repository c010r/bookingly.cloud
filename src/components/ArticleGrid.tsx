import type { Article } from "@/lib/repo";
import ArticleCard from "./ArticleCard";

/**
 * Retícula de seis columnas con ritmo de revista: las dos primeras piezas van
 * a doble ancho y el resto a un tercio, de modo que cada bloque abre fuerte y
 * luego respira. En movil es una sola columna; a partir de sm, dos.
 */
export default function ArticleGrid({
  articulos,
  amplias = 2,
}: {
  articulos: Article[];
  /** Cuantas piezas de cabeza van a doble ancho. */
  amplias?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-6">
      {articulos.map((a, i) => (
        <div key={a.id} className={i < amplias ? "lg:col-span-3" : "lg:col-span-2"}>
          <ArticleCard
            article={a}
            index={i}
            variante={i < amplias ? "amplia" : "estandar"}
          />
        </div>
      ))}
    </div>
  );
}
