// WCAG 2.2 contrast helpers. Pure (no imports) so it can be unit-tested and used in both server and browser.
export type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return 0;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface ThemeColors { brand: string; deep: string; leaf: string; mint: string; gold: string; canvas: string; ink: string }

// Fixed tokens that are not admin-editable but sit on editable backgrounds.
const WHITE = "#FFFFFF";
const INK_SOFT = "#64746A";

/** Every pairing the site actually renders. Publishing a theme is blocked if any fails (4.5:1 body text). */
export function checkTheme(c: ThemeColors) {
  const rules: { label: string; fg: string; bg: string }[] = [
    { label: "Body text on page background", fg: c.ink, bg: c.canvas },
    { label: "Body text on white cards", fg: c.ink, bg: WHITE },
    { label: "Secondary text on page background", fg: INK_SOFT, bg: c.canvas },
    { label: "Secondary text on white cards", fg: INK_SOFT, bg: WHITE },
    { label: "Primary buttons (white on primary green)", fg: WHITE, bg: c.brand },
    { label: "Dark sections and footer (white on deep green)", fg: WHITE, bg: c.deep },
    { label: "Secondary green buttons (white on secondary green)", fg: WHITE, bg: c.leaf },
    { label: "Gold buttons and badges (deep green on gold)", fg: c.deep, bg: c.gold },
    { label: "Text on mint panels", fg: c.ink, bg: c.mint },
    { label: "Links and headings (primary green on white)", fg: c.brand, bg: WHITE },
    { label: "Links and headings (primary green on page background)", fg: c.brand, bg: c.canvas },
  ];
  return rules.map((r) => { const ratio = contrast(r.fg, r.bg); return { label: r.label, ratio: Math.round(ratio * 100) / 100, pass: ratio >= 4.5 }; });
}
