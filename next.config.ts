import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg", "@extractus/article-extractor"],
  experimental: {
    // La ingesta puede tardar; damos margen a las server actions.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default config;
