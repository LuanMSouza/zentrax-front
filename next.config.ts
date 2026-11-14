import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // NEXT_DIST_DIR=.next-qa npm run build: build de teste numa pasta separada, sem encostar na .next que está no ar
    distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
