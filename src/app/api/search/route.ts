import { NextRequest, NextResponse } from "next/server";
import { searchPublished } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q.trim() || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const articles = await searchPublished(q, 8);
    return NextResponse.json({
      results: articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: a.category,
        dek: a.dek,
        reading_minutes: a.reading_minutes,
        source_name: a.source_name,
        published_at: a.published_at,
      })),
    });
  } catch (err) {
    console.error("Error en búsqueda:", err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
