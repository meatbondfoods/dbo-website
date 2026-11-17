import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { PreviewBanner } from "@/components/PreviewBanner";
import { PublicOnly } from "@/components/PublicOnly";
import { getRepositories } from "@/lib/repositories";
import { pageContent } from "@/lib/content/server";
import { themeCss } from "@/lib/content/themeCss";
import { draftMode } from "next/headers";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MeatBond Mart | Premium Meat, Poultry & Food Shopping", template: "%s | MeatBond Mart" },
  description: "Fresh chicken, processed products and quality meat from MeatBond Foods, delivered across Dhaka.",
};
export const viewport: Viewport = { themeColor: "#124C32", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, theme, site, { isEnabled: preview }] = await Promise.all([
    getRepositories().catalog.listCategories(), pageContent("theme"), pageContent("site"), draftMode(),
  ]);
  return (
    <html lang="en" className={sans.variable}>
      <head><style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} /></head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:text-brand focus:shadow-lift">Skip to content</a>
        {preview && <PreviewBanner />}
        <PublicOnly><Header categories={categories} announcement={site.announcement} /></PublicOnly>
        <main id="main" className="flex-1">{children}</main>
        <PublicOnly><Footer categories={categories} site={site} /></PublicOnly>
        <PublicOnly><CartDrawer /></PublicOnly>
      </body>
    </html>
  );
}
