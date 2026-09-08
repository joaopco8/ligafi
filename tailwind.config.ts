import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mata: {
          DEFAULT: "#0F3D2E",
          card: "#134A38",
          border: "#1C5E48",
          soft: "#1A5A45",
        },
        palha: {
          DEFAULT: "#F5F0B0",
          dark: "#E8E08F",
        },
        entrada: "#6EE7A8",
        saida: "#F87171",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        display: ["\"Host Grotesk\"", "var(--font-outfit)", "system-ui", "sans-serif"],
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        draw: {
          "0%": { strokeDashoffset: "40" },
          "100%": { strokeDashoffset: "0" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        pop: "pop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        fadeUp: "fadeUp 0.35s ease-out both",
        draw: "draw 0.5s ease-out 0.2s both",
        slideIn: "slideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        fadeIn: "fadeIn 0.2s ease-out both",
        slideUp: "slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
