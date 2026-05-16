/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201d",
        mist: "#f6f4ef",
        moss: "#476657",
        jade: "#007f73",
        clay: "#c76f4c",
        marigold: "#f0b44c",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(23, 32, 29, 0.16)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
