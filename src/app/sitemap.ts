import type { MetadataRoute } from "next";
import { getPublished } from "@/lib/repo";
import { CATEGORIES } from "@/lib/categories";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublished(1000);

  return [
    { url: env.siteUrl, changeFrequency: "hourly", priority: 1 },
    ...articles.map((a) => ({
      url: `${env.siteUrl}/noticia/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${env.siteUrl}/categoria/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
