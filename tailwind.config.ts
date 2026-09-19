import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F0E6",
        card: "#FDFBF5",
        ink: "#20261F",
        muted: "#78715F",
        line: "#E4DECC",
        forest: "#0B3B2A",
        forest2: "#0F4A35",
        cream: "#F6F1E1",
        gold: "#C7A14A",
        brand: "#0E6E4C",
        brandsoft: "#E4EFE7",
        flag: "#9A6700",
        flagsoft: "#F8EFD9",
        over: "#B3402A",
        oversoft: "#F7E4DE"
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
