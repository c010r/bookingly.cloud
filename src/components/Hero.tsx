import type { Article } from "@/lib/repo";
import HeroBento from "./HeroBento";

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
    <HeroBento
      destacadas={destacadas}
      recientes={recientes}
      masLeidas={masLeidas}
    />
  );
}
