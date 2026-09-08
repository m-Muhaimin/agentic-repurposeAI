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
          50: "#f5f7ff",
          100: "#e8edff",
          200: "#cdd7ff",
          300: "#a3b5ff",
          400: "#6b8cff",
          500: "#2A4DFF",
          600: "#1e3fd4",
          700: "#172fab",
          800: "#122585",
          900: "#0e1c68",
          950: "#0a1140"
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