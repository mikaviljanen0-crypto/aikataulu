import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paikallisen kehityksen projektijuuri. Eristää sovelluksen muista kansioista.
  turbopack: {
    root: process.cwd(),
  },
  // GitHub voi tuottaa valmiin selaimessa toimivan paketin ilman
  // käyttäjän koneella suoritettavaa Next.js-käännöstä.
  ...(process.env.SNEDO_STATIC_EXPORT === "1" ? { output: "export" as const } : {}),
};

export default nextConfig;
