/**
 * MeatBond Mart design tokens: the single source of truth for colour.
 * Every component uses these semantic names; never hard-code hex values in components.
 * Contrast notes (WCAG 2.2 AA): ink/ink-soft pass 4.5:1 on canvas and white (ink-soft does NOT on mint,
 * so use ink on mint). Gold is for fills and accents on deep green, never for text on light backgrounds.
 */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#124C32",        // Primary Forest Green
        deep: "#0B3525",         // Deep Forest Green
        leaf: "#176B3A",         // Secondary Green
        mint: "#D9F3E5",         // Soft Mint
        "mint-light": "#EFF8F2", // Light Mint
        gold: "#D6AD45",         // Premium Gold (sparingly)
        canvas: "#F7F9F6",       // Main background
        ink: "#26352D",          // Primary text
        "ink-soft": "#64746A",   // Secondary text
        hairline: "#E3EAE4",     // Borders
        danger: "#C62828",
        success: "#18804A",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      maxWidth: { page: "78rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(11,53,37,0.05), 0 4px 16px rgba(11,53,37,0.05)",
        lift: "0 2px 4px rgba(11,53,37,0.06), 0 12px 28px rgba(11,53,37,0.10)",
      },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: { "slide-in": "slide-in 240ms ease-out", "fade-in": "fade-in 200ms ease-out" },
    },
  },
  plugins: [],
};
