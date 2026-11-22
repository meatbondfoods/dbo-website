import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { PreviewBanner } from "@/components/PreviewBanner";
import { PublicOnly } from "@/components/PublicOnly";
import { MetaPixel } from "@/components/MetaPixel";
import { getRepositories } from "@/lib/repositories";
import { pageContent } from "@/lib/content/server";
import { themeCss } from "@/lib/content/themeCss";
import { draftMode } from "next/headers";
import { getContent } from "@/lib/content/store";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// SEO comes from the PUBLISHED admin-managed settings (never a draft).
export function generateMetadata(): Metadata {
  const seo = getContent("seo");
  const siteTitle = seo.siteTitle || "MeatBond MART | Quality That Builds Trust";
  const ogImage = seo.ogImage || "/meatbond-mart-logo.png";
  return {
    title: { default: siteTitle, template: "%s | MeatBond MART" },
    description: seo.description,
    openGraph: {
      title: siteTitle,
      description: seo.description,
      siteName: "MeatBond MART",
      images: [{ url: ogImage, width: 1024, height: 384, alt: "MeatBond MART" }],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "32x32" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}
export const viewport: Viewport = { themeColor: "#124C32", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, theme, site, nav, brand, { isEnabled: preview }] = await Promise.all([
    getRepositories().catalog.listCategories(), pageContent("theme"), pageContent("site"), pageContent("navigation"), pageContent("brand"), draftMode(),
  ]);
  return (
    <html lang="en" className={sans.variable}>
      <head><style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} /></head>
      <body className="flex min-h-screen flex-col">
        <MetaPixel />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:text-brand focus:shadow-lift">Skip to content</a>
        {preview && <PreviewBanner />}
        <PublicOnly><Header categories={categories} announcement={site.announcement} nav={nav} logo={brand} /></PublicOnly>
        <main id="main" className="flex-1">{children}</main>
        <PublicOnly><Footer categories={categories} site={site} logo={brand} /></PublicOnly>
        <PublicOnly><CartDrawer /></PublicOnly>
      </body>
    </html>
  );
}
