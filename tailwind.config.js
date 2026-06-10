/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--surface-muted) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        "border-soft": "rgb(var(--border-soft) / 0.12)",
        "border-subtle": "rgb(var(--border-subtle) / 0.08)",
        "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        "accent-cyan": "rgb(var(--accent-cyan) / <alpha-value>)",
        "accent-cyan-soft": "rgb(var(--accent-cyan-soft) / 0.12)",
        "focus-ring": "rgb(var(--focus-ring) / <alpha-value>)",
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
        display: [
          "Outfit",
          "Inter",
          "Be Vietnam Pro",
          "Plus Jakarta Sans",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "Inter",
          "Be Vietnam Pro",
          "Plus Jakarta Sans",
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
