import { notFound } from "next/navigation";
import { getAdminState } from "@/lib/content/store";
import { isContentKey, type ContentKey } from "@/lib/content/schema";
import { ContentEditor, type EditorState, type FieldDef } from "../../_components/ContentEditor";

export const dynamic = "force-dynamic";

const COLOR = (name: string, label: string, hint: string): FieldDef => ({ name, label, hint, type: "color" });

const CONFIG: Partial<Record<ContentKey, { title: string; intro: string; fields: FieldDef[] }>> = {
  hero: {
    title: "Homepage hero",
    intro: "The first section visitors see. Images must already exist in the site's public folder; uploading new images arrives with storage in a later phase.",
    fields: [
      { name: "eyebrow", label: "Small label", type: "text" },
      { name: "headline", label: "Headline", type: "text" },
      { name: "subheadline", label: "Supporting text", type: "textarea" },
      { name: "primaryLabel", label: "Primary button text", type: "text" }, { name: "primaryHref", label: "Primary button link", type: "text", hint: "A path like /shop or a full https:// link" },
      { name: "secondaryLabel", label: "Secondary button text", type: "text", hint: "Leave empty to hide the button" }, { name: "secondaryHref", label: "Secondary button link", type: "text" },
      { name: "imagePath", label: "Hero image path", type: "text", hint: "For example /products/hero.svg" }, { name: "imageAlt", label: "Image description (alt text)", type: "text", hint: "Describes the image for screen-reader users" },
      { name: "trustItems", label: "Trust points (one per line, up to 4)", type: "lines" },
    ],
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
    intro: "Delivery is free within the free radius. Beyond it the standard charge applies, unless the optional free-over-amount rule is met. Prices and stock are never set here: they come from the ERP. All values are unconfirmed samples until the business confirms them.",
    fields: [
      { name: "freeRadiusKm", label: "Free delivery within (km)", type: "number" },
      { name: "chargeBeyond", label: "Delivery charge beyond the free radius (৳)", type: "number" },
      { name: "freeOverAmount", label: "Also free when subtotal is at least (৳)", type: "number", hint: "Enter 0 to turn this rule off" },
      { name: "areas", label: "Delivery areas and distance from our facility", type: "areas", hint: "One per line as: Area name | distance in km. Customers choose from this list at checkout. Areas not listed are charged." },
    ],
  },
};

export default async function ContentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = isContentKey(key) ? CONFIG[key] : undefined;
  if (!isContentKey(key) || !cfg) notFound();
  const state = getAdminState(key) as unknown as EditorState;
  return (
    <div className="py-8">
      <h1 className="text-3xl">{cfg.title}</h1>
      <div className="mt-4"><ContentEditor key={`${key}-v${state.version}`} contentKey={key} fields={cfg.fields} intro={cfg.intro} initial={state} /></div>
    </div>
  );
}
