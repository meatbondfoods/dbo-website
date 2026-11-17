import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { getRepositories } from "@/lib/repositories";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MeatBond Mart | Premium Meat, Poultry & Food Shopping", template: "%s | MeatBond Mart" },
  description: "Fresh chicken, processed products and quality meat from MeatBond Foods, delivered across Dhaka.",
};
export const viewport: Viewport = { themeColor: "#124C32", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await getRepositories().catalog.listCategories();
  return (
    <html lang="en" className={sans.variable}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:text-brand focus:shadow-lift">Skip to content</a>
        <Header categories={categories} />
        <main id="main" className="flex-1">{children}</main>
        <Footer categories={categories} />
        <CartDrawer />
      </body>
    </html>
  );
}
