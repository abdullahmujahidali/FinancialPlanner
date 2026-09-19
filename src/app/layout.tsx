import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import SWRegister from "@/components/SWRegister";

const sans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Hearthbook",
  description: "The family ledger — expenses, assets, goals.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Hearthbook" }
};
export const viewport: Viewport = {
  themeColor: "#F7F5EF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={sans.className}>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
