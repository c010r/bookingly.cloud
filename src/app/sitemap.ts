import type { MetadataRoute } from "next";
import { getPublished, getTopTags } from "@/lib/repo";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, tags] = await Promise.all([getPublished(1000), getTopTags(200)]);

  return [
    { url: env.siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${env.siteUrl}/temas`, changeFrequency: "daily", priority: 0.5 },
    ...articles.map((a) => ({
      url: `${env.siteUrl}/noticia/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...tags.map((t) => ({
      url: `${env.siteUrl}/tema/${encodeURIComponent(t.tag)}`,
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
  ];
}
