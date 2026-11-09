/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { display: ["Outfit", "sans-serif"], sans: ["IBM Plex Sans", "sans-serif"], mono: ["IBM Plex Mono", "monospace"] },
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))", card: "hsl(var(--card))",
        success: "hsl(var(--success))", warning: "hsl(var(--warning))", danger: "hsl(var(--danger))",
      },
      keyframes: { rise: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } } },
      animation: { rise: "rise .45s ease-out both" },
    },
  },
  plugins: [],
};
