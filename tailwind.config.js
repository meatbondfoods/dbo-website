/**
 * MeatBond Mart design tokens. Colours are CSS variables (space-separated RGB) so an admin can publish a
 * theme without a code change. Defaults live in globals.css :root and in src/lib/content/defaults.ts.
 * Never hard-code hex values in components. Publishing a theme is blocked unless every text pairing
 * still meets WCAG 4.5:1 (src/lib/content/contrast.ts).
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: v("brand"),         // Primary Forest Green      #124C32
        deep: v("deep"),           // Deep Forest Green         #0B3525
        leaf: v("leaf"),           // Secondary Green           #176B3A
        mint: v("mint"),           // Soft Mint                 #D9F3E5
        "mint-light": v("mint-light"), // Light Mint            #EFF8F2
        gold: v("gold"),           // Premium Gold, sparingly   #D6AD45
        canvas: v("canvas"),       // Main background           #F7F9F6
        ink: v("ink"),             // Primary text              #26352D
        "ink-soft": v("ink-soft"), // Secondary text            #64746A
        hairline: v("hairline"),   // Borders                   #E3EAE4
        danger: v("danger"),       // Error                     #C62828
        success: v("success"),     // Success                   #18804A
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
