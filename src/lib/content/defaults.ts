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
    // UNCONFIRMED: "free within 7 km" is the owner's stated rule. The charge beyond it, the free-over-amount
    // rule and the area distances below are SAMPLE values pending confirmation.
    freeRadiusKm: 7, chargeBeyond: 80, freeOverAmount: 1500,
    areas: [
      { name: "Gulshan", distanceKm: 4 }, { name: "Banani", distanceKm: 5 }, { name: "Uttara", distanceKm: 12 },
      { name: "Dhanmondi", distanceKm: 8 }, { name: "Mirpur", distanceKm: 11 },
    ],
  },
  productDisplay: { items: [] },
};
