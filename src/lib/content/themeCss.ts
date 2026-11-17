import { hexToRgb } from "./contrast";
import type { ContentMap } from "./schema";

const RADIUS = { md: "0.375rem", lg: "0.5rem", full: "9999px" } as const;
const rgb = (hex: string) => (hexToRgb(hex) ?? [0, 0, 0]).join(" ");

/** CSS variable overrides for the published theme. Every value is validated (hex / enum), so it is safe to inline. */
export function themeCss(t: ContentMap["theme"]): string {
  return `:root{--c-brand:${rgb(t.brand)};--c-deep:${rgb(t.deep)};--c-leaf:${rgb(t.leaf)};--c-mint:${rgb(t.mint)};--c-gold:${rgb(t.gold)};--c-canvas:${rgb(t.canvas)};--c-ink:${rgb(t.ink)};--r-btn:${RADIUS[t.buttonRadius]};--w-heading:${t.headingWeight}}`;
}
