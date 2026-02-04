/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
    },
  },
},
theme: {
  extend: {
    colors: {
      noir: {
        black: "#050505",
        charcoal: "#0e0e0e",
        smoke: "#1a1a1a",
        ash: "#2a2a2a",
      },
      blood: {
        DEFAULT: "#8b1d1d",
        dark: "#6f1616",
        soft: "rgba(139,29,29,0.15)",
      },
    },
  },
},

  plugins: [],
};
