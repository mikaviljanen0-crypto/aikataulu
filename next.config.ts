import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Älä anna Turbopackin valita koko Downloads-kansiota sovelluksen juureksi.
  // VS Coden terminaali käynnistää ohjelman Snedo_Aikataulu_1_0-kansiosta.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
