import { NextResponse } from "next/server";
import { registerView } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Suma una visita. Lo llama el navegador tras pintar el articulo, no el
 * servidor al renderizar: asi no cuentan las precargas de Next ni los
 * rastreadores que solo piden el HTML.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    await registerView(slug);
  } catch {
    // Un contador roto nunca debe romper la lectura de la noticia.
  }
  return NextResponse.json({ ok: true });
}
