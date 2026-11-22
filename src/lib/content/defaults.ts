import type { ContentMap } from "./schema";

// Used until an admin publishes something. SAMPLE / UNCONFIRMED values are noted inline.
export const DEFAULTS: ContentMap = {
  hero: {
    eyebrow: "MeatBond Foods",
    headline: "Fresh poultry & quality meat, delivered with care.",
    subheadline: "Premium chicken, processed products and everyday meat from MeatBond Foods, packed to order and delivered chilled across Chattagram.",
    primaryLabel: "Shop now", primaryHref: "/shop",
    secondaryLabel: "Explore products", secondaryHref: "/shop?category=chicken-cuts",
    imagePath: "/products/hero.svg", imageAlt: "Placeholder for the hero photograph of fresh poultry",
    trustItems: ["Chilled delivery", "Cash on delivery", "Live order tracking"],
  },
  theme: {
    brand: "#124C32", deep: "#0B3525", leaf: "#176B3A", mint: "#D9F3E5", gold: "#D6AD45", canvas: "#F7F9F6", ink: "#26352D",
    buttonRadius: "lg", headingWeight: "700",
  },
  site: {
    announcement: "Free delivery within 7 km in Chattagram · Cash on delivery available",
    phone: "", email: "", address: "Chandgaon, Chattagram",
    facebook: "", instagram: "", youtube: "",
    footerBlurb: "Premium meat, poultry and food shopping from MeatBond Foods, packed with care and delivered across Chattagram. Free delivery within 7 km.",
  },
  commerce: {
    active: true,
    freeRadiusKm: 7,
    chargeBeyond: 80,
    freeOverAmount: 0,
    areas: [
      { name: "Chandgaon", distanceKm: 0 },
      { name: "Bahaddarhat", distanceKm: 1.3 },
      { name: "Muradpur", distanceKm: 2.0 },
      { name: "Panchlaish", distanceKm: 2.7 },
      { name: "Chawkbazar", distanceKm: 2.9 },
      { name: "Sholashahar", distanceKm: 2.9 },
      { name: "Nasirabad", distanceKm: 3.4 },
      { name: "GEC Circle", distanceKm: 3.6 },
      { name: "Bakalia", distanceKm: 3.7 },
      { name: "Mehedibag", distanceKm: 3.7 },
      { name: "Oxygen", distanceKm: 4.0 },
      { name: "Bayezid", distanceKm: 4.0 },
      { name: "Khulshi", distanceKm: 4.5 },
      { name: "Lalkhan Bazar", distanceKm: 4.6 },
      { name: "Kotwali", distanceKm: 4.8 },
      { name: "New Market", distanceKm: 5.5 },
      { name: "Agrabad", distanceKm: 7.2 },
      { name: "Pahartali", distanceKm: 7.7 },
      { name: "Halishahar", distanceKm: 9.1 },
      { name: "Patenga", distanceKm: 12.5 },
    ],
  },
  productDisplay: { items: [] },
  banners: {
    items: [
      {
        id: "welcome",
        title: "Order fresh poultry and meat online",
        text: "Free chilled delivery within 7 km of Chandgaon, Chattagram. Cash on delivery available.",
        ctaLabel: "Start shopping",
        ctaHref: "/shop",
        imagePath: "",
        active: true,
      },
    ],
  },
  navigation: {
    showCategories: true,
    items: [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: "About Us", href: "/about" }, { label: "Contact", href: "/contact" }],
  },
  sections: {
    items: [
      { id: "categories", visible: true, title: "" }, { id: "featured", visible: true, title: "" }, { id: "why", visible: true, title: "" },
      { id: "quality", visible: true, title: "" }, { id: "best", visible: true, title: "" }, { id: "banner", visible: true, title: "" },
      { id: "reviews", visible: true, title: "" }, { id: "newsletter", visible: true, title: "" },
    ],
  },
  seo: { siteTitle: "MeatBond MART | Quality That Builds Trust", description: "Fresh chicken, processed products and quality meat from MeatBond Foods.", ogImage: "/meatbond-mart-logo.png" },
  brand: { logoPath: "/meatbond-mart-logo.png", logoAlt: "MeatBond MART" },
};
