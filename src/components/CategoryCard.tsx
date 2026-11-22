import Link from "next/link";
import { ArrowRight, Beef, Drumstick, Egg, Flame, Package, Sparkles, UtensilsCrossed, LucideIcon } from "lucide-react";
import type { Category } from "@/lib/domain/types";

const CATEGORY_META: Record<string, { icon: LucideIcon; badge: string; subtitle: string; href?: string }> = {
  "chicken-cuts": {
    icon: Drumstick,
    badge: "Farm Fresh",
    subtitle: "Broiler & Sonali breast, drumsticks, bone-in & boneless cuts.",
  },
  "whole-chicken": {
    icon: Egg,
    badge: "Cleaned & Chilled",
    subtitle: "Whole broiler & Sonali birds, dressed and kitchen-ready.",
  },
  "other-meat": {
    icon: Beef,
    badge: "100% Halal",
    subtitle: "Bone-in curry cuts, tender beef mince and slow-cook cuts.",
  },
  "beef-cuts": {
    icon: Beef,
    badge: "Premium Beef",
    subtitle: "Traditional curry cuts, lean minced beef & stew portions.",
  },
  "mutton-cuts": {
    icon: Sparkles,
    badge: "Selected Cut",
    subtitle: "Tender mutton leg, shoulder and rich curry portions.",
  },
  processed: {
    icon: Package,
    badge: "Ready to Cook",
    subtitle: "Smoked sausages, spiced kebabs, nuggets & burger patties.",
  },
  "processed-meat": {
    icon: Package,
    badge: "Ready to Cook",
    subtitle: "Smoked sausages, spiced kebabs, nuggets & burger patties.",
  },
  "marinated-bbq": {
    icon: Flame,
    badge: "Chef's Special",
    subtitle: "Special tandoori, tikka marinades and BBQ grill cuts.",
  },
  essentials: {
    icon: UtensilsCrossed,
    badge: "Pantry",
    subtitle: "Gourmet seasonings, spice blends and kitchen bundles.",
  },
};

export function CategoryCard({ category, count }: { category: Category; count?: number }) {
  const meta = CATEGORY_META[category.slug] ?? CATEGORY_META[category.id] ?? {
    icon: Package,
    badge: "Fresh & Safe",
    subtitle: category.description || "Fresh selections packed to order.",
  };
  const Icon = meta.icon;
  const href = `/shop?category=${category.slug}`;

  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-lift"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/70 text-brand shadow-sm transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:scale-105">
            <Icon size={26} aria-hidden="true" />
          </span>
          <span className="rounded-full bg-mint-light px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-leaf border border-brand/10">
            {meta.badge}
          </span>
        </div>

        <h3 className="mt-5 text-lg font-bold text-deep transition-colors group-hover:text-brand leading-snug">
          {category.name}
        </h3>

        <p className="mt-2 text-xs sm:text-sm text-ink-soft leading-relaxed line-clamp-2">
          {category.description || meta.subtitle}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-hairline/80 pt-4 text-xs font-semibold text-brand">
        <span>{count !== undefined && count > 0 ? `${count} product${count === 1 ? "" : "s"}` : "Explore selection"}</span>
        <span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-1 font-bold">
          Shop now <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
