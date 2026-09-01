import { getPublished } from "@/lib/repo";
import { env } from "@/lib/env";
import { excerpt } from "@/lib/markdown";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = await getPublished(40);

  const items = articles
    .map((a) => {
      const url = `${env.siteUrl}/noticia/${a.slug}`;
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${(a.published_at ?? a.created_at).toUTCString()}</pubDate>
      <description>${esc(a.dek || excerpt(a.body_md))}</description>
      <source url="${esc(a.source_url)}">${esc(a.source_name)}</source>
${a.tags.map((t) => `      <category>${esc(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(env.siteName)}</title>
    <link>${esc(env.siteUrl)}</link>
    <description>${esc(env.siteDescription)}</description>
    <language>es</language>
    <atom:link href="${esc(env.siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
