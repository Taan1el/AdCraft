import path from "path";
import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();

const nextConfig: NextConfig = {
  // GitHub Pages (and similar static hosts) need a fully static export.
  output: "export",

  // GitHub Pages serves from a subpath for project sites: /<repo>/
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  images: {
    // Required for `next export` / static hosting unless you use a loader.
    unoptimized: true,
  },

  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
