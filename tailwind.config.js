/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    forest: { DEFAULT: "#1F3D2B", dark: "#162C1F", light: "#2E5A40" },
    cream: "#FAF7F0", charcoal: "#222522", accent: "#B4472F",
  } } },
  plugins: [],
};
