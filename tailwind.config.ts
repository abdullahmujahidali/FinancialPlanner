import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5EF",
        card: "#FFFFFF",
        ink: "#20261F",
        muted: "#6B7267",
        line: "#E2DFD5",
        brand: "#0E6E4C",
        brandsoft: "#E4EFE7",
        flag: "#9A6700",
        flagsoft: "#FBF0DA",
        over: "#B3402A",
        oversoft: "#F7E4DE"
      },
      borderRadius: { DEFAULT: "6px" }
    }
  },
  plugins: []
};
export default config;
