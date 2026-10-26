import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snedo Aikataulu",
  description: "Snedon rakennustyömaan aikataulusuunnittelu ja työmaakokousten seuranta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fi">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
