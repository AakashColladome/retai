/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary, #c2410c)",
          accent: "var(--brand-accent, #d97706)",
          bg: "var(--brand-bg, #fff7ed)",
        },
      },
    },
  },
  plugins: [],
};
