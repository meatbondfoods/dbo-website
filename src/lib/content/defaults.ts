import type { ContentMap } from "./schema";

// Used until an admin publishes something. SAMPLE / UNCONFIRMED values are noted inline.
export const DEFAULTS: ContentMap = {
  hero: {
    eyebrow: "MeatBond Foods",
    headline: "Fresh poultry & quality meat, delivered with care.",
    subheadline: "Premium chicken, processed products and everyday meat from MeatBond Foods, packed to order and delivered chilled across Dhaka.",
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
    announcement: "Cash on delivery available · Chilled delivery across Dhaka",
    phone: "", email: "", address: "",       // blank until the business confirms real details; nothing is invented
    facebook: "", instagram: "", youtube: "",
    footerBlurb: "Premium meat, poultry and food shopping from MeatBond Foods, packed with care and delivered across Dhaka.",
  },
  commerce: {
    // Delivery pricing and radius are NOT approved by the business. The rules stay configurable but INACTIVE:
    // no charge is applied and nothing about delivery pricing is promised to customers.
    active: false, freeRadiusKm: 0, chargeBeyond: 0, freeOverAmount: 0, areas: [],
  },
  productDisplay: { items: [] },
  banners: {
    // One neutral banner. It makes no delivery-charge or delivery-radius claim (that policy is not approved).
    items: [{ id: "welcome", title: "Order fresh poultry and meat online", text: "Cash on delivery is available. Our team confirms your order, and your delivery charge, by phone.", ctaLabel: "Start shopping", ctaHref: "/shop", imagePath: "", active: true }],
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
  seo: { siteTitle: "MeatBond Mart | Premium Meat, Poultry & Food Shopping", description: "Fresh chicken, processed products and quality meat from MeatBond Foods.", ogImage: "" },
  brand: { logoPath: "", logoAlt: "MeatBond Mart" },
};
