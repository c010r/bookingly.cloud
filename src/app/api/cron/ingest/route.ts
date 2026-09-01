import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Programa una llamada periodica a este endpoint (Vercel Cron, GitHub Actions,
 * systemd timer...) con la cabecera Authorization: Bearer $CRON_SECRET.
 * Los articulos entran como borradores; publicar sigue siendo manual.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const token = auth?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");

  if (!token || token !== env.cronSecret) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  try {
    const report = await runIngest();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
