import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Design tokens ported from the SaasAble Tailwind kit ("ai" preset, light).
// Primary is a professional blue; neutral is the kit's cool-gray ramp.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5f5fa",
          100: "#e7e5f5",
          200: "#cdc8ef",
          300: "#a297e7",
          400: "#7160e2",
          500: "#3923c7",
          600: "#3221a1",
          700: "#2a1f75",
          800: "#241c59",
          900: "#1d173f",
          950: "#141127"
        },
        secondary: {
          50: "#b0bcc7",
          100: "#d3e4f8",
          200: "#b7c8db",
          300: "#74899d",
          400: "#607588",
          500: "#4f6070",
          600: "#38444f",
          700: "#21282e",
          800: "#384858",
          900: "#0b1d2b",
          950: "#000000"
        },
        neutral: {
          50: "#f9f9fc",
          100: "#f1f4f9",
          200: "#ebEEf3",
          300: "#e6e8ee",
          400: "#e2e2e5",
          500: "#d7dadf",
          600: "#c2c7ce",
          700: "#72787e",
          800: "#42474e",
          900: "#1a1c1e",
          950: "#000000"
        },
        theme: {
          "text-primary": "#1a1c1e",
          "text-secondary": "#42474e",
          divider: "#c2c7ce",
          "bg-default": "#ffffff",
          "bg-paper": "#ffffff"
        }
      },
      fontFamily: {
        // Figtree = body, Archivo = display/headings (kit's split)
        sans: ["var(--font-figtree)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-archivo)", ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
};

export default config;