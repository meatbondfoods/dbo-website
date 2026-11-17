/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#1F3D2B", dark: "#162C1F", light: "#2E5A40", tint: "#E8EFE9" },
        cream: { DEFAULT: "#FAF7F0", deep: "#F1EBDD" },
        charcoal: "#222522",
        clay: "#B4472F",
        line: "#E2DCCB",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { page: "76rem" },
    },
  },
  plugins: [],
};
