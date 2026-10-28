import type { Metadata } from "next";
import "./globals.css";
import "../styles/base.css";
import "../styles/topbar.css";
import "../styles/projectbar.css";
import "../styles/schedule.css";
import "../styles/gantt.css";
import "../styles/ux.css";
import "../styles/print.css";
import "../styles/report.css";
import "../styles/sticky-workspace.css";

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
