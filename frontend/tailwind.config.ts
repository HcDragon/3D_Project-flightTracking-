import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        sun: "hsl(var(--sun))",
        dusk: "hsl(var(--dusk))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glass:
          "0 0 0 1px hsl(38 80% 55% / 0.12), 0 12px 40px rgba(0, 20, 50, 0.55), 0 0 80px hsl(28 90% 50% / 0.06)",
        sun: "0 0 40px hsl(38 100% 55% / 0.35), 0 0 80px hsl(28 100% 50% / 0.15)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "sun-fade":
          "radial-gradient(ellipse 80% 60% at 90% -10%, hsl(28 95% 55% / 0.25), transparent 50%)",
        "sky-fade":
          "radial-gradient(ellipse 70% 50% at 10% 0%, hsl(199 85% 45% / 0.18), transparent 55%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
