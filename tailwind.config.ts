import type { Config } from "tailwindcss";

/**
 * Neo-brutalist palette: acid lime, true black, paper white.
 * Flat blocks, hard 2px borders, no soft shadows — contrast does the work.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        acid: "#E2FB4F",
        aciddim: "#C9E23F",
        ink: "#0A0A0A",
        ink2: "#161616",
        paper: "#F2F2F0",
        card: "#FFFFFF",
        line: "#0A0A0A",
        muted: "#6B6B6B",
        blush: "#E98D7C",
        blushdim: "#D97A68",
        good: "#1F7A4D",
        over: "#C43C22"
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      },
      borderRadius: {
        block: "0px",
        soft: "14px",
        pill: "999px"
      },
      boxShadow: {
        // hard offset shadow — the brutalist "lift"
        hard: "4px 4px 0 0 #0A0A0A",
        hardsm: "2px 2px 0 0 #0A0A0A",
        hardlg: "6px 6px 0 0 #0A0A0A"
      }
    }
  },
  plugins: []
};
export default config;
