import type { ContentKey } from "@/lib/content/schema";
import type { ListDef } from "./ListField";

// Field definitions for the admin editors. A plain module (no "use client") imported by both the server page
// (title/intro) and the client editor (fields), so it must hold only data and small pure functions.
export interface FieldDef {
  name: string; label: string; hint?: string;
  type: "text" | "textarea" | "number" | "color" | "select" | "lines" | "areas" | "bool" | "image" | "list";
  options?: { value: string; label: string }[];
  list?: ListDef;
}

const COLOR = (name: string, label: string, hint: string): FieldDef => ({ name, label, hint, type: "color" });
const uid = () => `b-${Date.now().toString(36)}`;

export const CONFIG: Partial<Record<ContentKey, { title: string; intro: string; fields: FieldDef[] }>> = {
  hero: {
    title: "Homepage hero",
    intro: "The first section visitors see. Upload an image (PNG, JPEG or WebP, up to 2 MB) or choose one already on the site.",
    fields: [
      { name: "eyebrow", label: "Small label", type: "text" },
      { name: "headline", label: "Headline", type: "text" },
      { name: "subheadline", label: "Supporting text", type: "textarea" },
      { name: "primaryLabel", label: "Primary button text", type: "text" }, { name: "primaryHref", label: "Primary button link", type: "text", hint: "A path like /shop or a full https:// link" },
      { name: "secondaryLabel", label: "Secondary button text", type: "text", hint: "Leave empty to hide the button" }, { name: "secondaryHref", label: "Secondary button link", type: "text" },
      { name: "imagePath", label: "Hero image", type: "image" }, { name: "imageAlt", label: "Image description (alt text)", type: "text", hint: "Describes the image for screen-reader users" },
      { name: "trustItems", label: "Trust points (one per line, up to 4)", type: "lines" },
    ],
  },
  banners: {
    title: "Banners",
    intro: "Promotional banners shown in the homepage banner section. Only active banners appear. Do not state delivery charges or free-delivery offers until the business has approved a delivery policy.",
    fields: [{ name: "items", label: "Banners (up to 5)", type: "list", list: {
      max: 5, titleOf: (i) => String(i.title ?? ""),
      newItem: () => ({ id: uid(), title: "New banner", text: "", ctaLabel: "", ctaHref: "", imagePath: "", active: false }),
      itemFields: [
        { name: "title", label: "Title", type: "text" }, { name: "ctaLabel", label: "Button text", type: "text", hint: "Leave empty for no button" },
        { name: "text", label: "Text", type: "textarea" }, { name: "ctaHref", label: "Button link", type: "text", hint: "A path like /shop or an https:// link" },
        { name: "imagePath", label: "Image (optional)", type: "image" }, { name: "active", label: "Show this banner on the website", type: "bool" },
      ] } }],
  },
  navigation: {
    title: "Navigation menu",
    intro: "The links in the website header. Search, the account icon and the cart are always shown.",
    fields: [
      { name: "showCategories", label: "Show the Categories drop-down", type: "bool" },
      { name: "items", label: "Menu links (up to 8)", type: "list", list: {
        max: 8, titleOf: (i) => String(i.label ?? ""), newItem: () => ({ label: "New link", href: "/" }),
        itemFields: [{ name: "label", label: "Label", type: "text" }, { name: "href", label: "Link", type: "text", hint: "A path like /shop or an https:// link" }] } },
    ],
  },
  sections: {
    title: "Homepage sections",
    intro: "Choose which homepage sections appear and in what order. A heading override replaces the section's default heading.",
    fields: [{ name: "items", label: "Sections (top to bottom)", type: "list", list: {
      fixed: true, titleOf: (i) => ({ categories: "Shop by category", featured: "Featured products", why: "Why choose us", quality: "Quality and freshness", best: "Best sellers", banner: "Promotional banner", reviews: "Customer reviews", newsletter: "Newsletter" } as Record<string, string>)[String(i.id)] ?? String(i.id),
      itemFields: [{ name: "visible", label: "Show this section", type: "bool" }, { name: "title", label: "Heading override (optional)", type: "text" }] } }],
  },
  seo: {
    title: "SEO",
    intro: "How the site appears in search results and when shared. The page title is followed by the site name.",
    fields: [
      { name: "siteTitle", label: "Home page title", type: "text", hint: "Up to 70 characters" },
      { name: "description", label: "Description", type: "textarea", hint: "Up to 200 characters" },
      { name: "ogImage", label: "Social sharing image (optional)", type: "image" },
    ],
  },
  brand: {
    title: "Logo and brand",
    intro: "Upload a logo to replace the built-in MeatBond Mart wordmark in the header and footer. Leave it empty to keep the wordmark.",
    fields: [{ name: "logoPath", label: "Logo image", type: "image", hint: "A PNG or WebP with a transparent background works best" }, { name: "logoAlt", label: "Logo description (alt text)", type: "text" }],
  },
  theme: {
    title: "Theme",
    intro: "Brand colours and button style. Colours are checked against WCAG contrast rules; a theme that makes text hard to read cannot be published.",
    fields: [
      COLOR("brand", "Primary green", "Buttons, links, headings accents. Official: #124C32"),
      COLOR("deep", "Deep green", "Footer, dark sections, headings. Official: #0B3525"),
      COLOR("leaf", "Secondary green", "Labels and highlights. Official: #176B3A"),
      COLOR("mint", "Soft mint", "Soft section backgrounds. Official: #D9F3E5"),
      COLOR("gold", "Gold", "Use sparingly for premium details. Official: #D6AD45"),
      COLOR("canvas", "Page background", "Official: #F7F9F6"),
      COLOR("ink", "Text colour", "Official: #26352D"),
      { name: "buttonRadius", label: "Button corners", type: "select", options: [{ value: "md", label: "Slightly rounded" }, { value: "lg", label: "Rounded" }, { value: "full", label: "Pill" }] },
      { name: "headingWeight", label: "Heading weight", type: "select", options: [{ value: "600", label: "Semibold" }, { value: "700", label: "Bold" }, { value: "800", label: "Extra bold" }] },
    ],
  },
  site: {
    title: "Site and contact",
    intro: "Contact details, social links and footer text. Anything left blank is hidden from the website. Nothing is invented.",
    fields: [
      { name: "announcement", label: "Announcement bar text", type: "text", hint: "Shown above the header. Leave empty to hide" },
      { name: "phone", label: "Phone", type: "text" }, { name: "email", label: "Email", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "facebook", label: "Facebook link", type: "text", hint: "Full https:// link" }, { name: "instagram", label: "Instagram link", type: "text" }, { name: "youtube", label: "YouTube link", type: "text" },
      { name: "footerBlurb", label: "Footer description", type: "textarea" },
    ],
  },
  commerce: {
    title: "Delivery",
    intro: "Delivery pricing and radius are NOT approved yet, so this policy is OFF: no charge is applied and customers are told the team confirms the delivery charge. Prices and stock are never set here: they come from the ERP. Switch the policy on only after the business approves the numbers.",
    fields: [
      { name: "active", label: "Apply this delivery policy (leave OFF until the business approves it)", type: "bool" },
      { name: "freeRadiusKm", label: "Free delivery within (km)", type: "number" },
      { name: "chargeBeyond", label: "Delivery charge beyond the free radius (৳)", type: "number" },
      { name: "freeOverAmount", label: "Also free when subtotal is at least (৳)", type: "number", hint: "Enter 0 to turn this rule off" },
      { name: "areas", label: "Delivery areas and distance from our facility", type: "areas", hint: "One per line as: Area name | distance in km. When the policy is on, customers choose from this list at checkout." },
    ],
  },
};
