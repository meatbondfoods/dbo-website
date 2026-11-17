import "./globals.css";
export const metadata = { title: "MeatBond Mart", description: "Premium Meat & Poultry Shopping" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
