import type { NextConfig } from "next";

const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
