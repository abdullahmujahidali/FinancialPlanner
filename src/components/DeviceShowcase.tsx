"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero showcase: a laptop and a phone, each holding a real screenshot of
 * the app, cycling through screens as the visitor scrolls or clicks a caption.
 *
 * The images are genuine captures of the running product against a seeded demo
 * household — never invented mockups — so what a visitor sees is what they get.
 * They are stills, which is why the screen labels below double as controls:
 * the swapping is the motion, the captions are the interaction.
 */

type Screen = {
  id: string;
  label: string;
  blurb: string;
  desktop: string;
  mobile: string;
};

const SCREENS: Screen[] = [
  {
    id: "home",
    label: "Home",
    blurb: "The month at a glance — spend against budget, what's saved, where it went.",
    desktop: "/shots/app-dashboard.png",
    mobile: "/shots/mobile-dashboard.png"
  },
  {
    id: "ledger",
    label: "Ledger",
    blurb: "Every line, searchable and filterable, with transfers and reimbursements marked.",
    desktop: "/shots/app-ledger.png",
    mobile: "/shots/mobile-ledger.png"
  },
  {
    id: "year",
    label: "Year",
    blurb: "Twelve months side by side, so a bad month is obvious against the rest.",
    desktop: "/shots/app-year.png",
    mobile: "/shots/mobile-dashboard.png"
  },
  {
    id: "goals",
    label: "Goals",
    blurb: "What you're saving toward, and how close it is.",
    desktop: "/shots/app-goals.png",
    mobile: "/shots/mobile-goals.png"
  }
];

export default function DeviceShowcase() {
  const [i, setI] = useState(0);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (touched || !visible) return;
    const t = setInterval(() => setI((n) => (n + 1) % SCREENS.length), 4200);
    return () => clearInterval(t);
  }, [touched, visible]);

  const pick = (n: number) => {
    setTouched(true);
    setI(n);
  };
  const cur = SCREENS[i];

  return (
    <div ref={root}>
      <div className="relative flex items-end justify-center gap-4 lg:gap-6">
        <Laptop src={cur.desktop} alt={`${cur.label} screen on desktop`} />
        <Phone src={cur.mobile} alt={`${cur.label} screen on mobile`} />
      </div>

      {/* Captions double as the control — the screens are stills. */}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {SCREENS.map((s, n) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(n)}
            aria-current={n === i}
            className={
              "rounded-full px-4 py-2 text-[13px] font-bold transition " +
              (n === i ? "bg-ink text-white" : "bg-card text-ink hover:bg-white")
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mx-auto mt-4 max-w-[46ch] text-center text-[14px] font-semibold text-muted">
        {cur.blurb}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** A laptop body drawn in CSS; only the screen is an image. */
function Laptop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full max-w-[860px] flex-1">
      <div className="rounded-[14px] bg-ink p-[10px] shadow-soft lg:rounded-[18px] lg:p-[14px]">
        <div className="overflow-hidden rounded-[6px] bg-page lg:rounded-[8px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={2880} height={1800} className="block w-full" />
        </div>
      </div>
      {/* Base + notch, the bit that makes it read as a laptop. */}
      <div className="mx-auto h-[10px] w-[112%] max-w-none rounded-b-[10px] bg-ink2 lg:h-[13px]" />
      <div className="mx-auto -mt-[7px] h-[5px] w-[84px] rounded-b-full bg-ink" />
    </div>
  );
}

/** A phone, hidden on small screens where it would crowd the laptop. */
function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="hidden w-[172px] shrink-0 md:block lg:w-[208px]">
      <div className="relative rounded-[30px] bg-ink p-[8px] shadow-soft lg:rounded-[36px] lg:p-[10px]">
        <div className="overflow-hidden rounded-[23px] bg-page lg:rounded-[27px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={1170} height={1992} className="block w-full" />
        </div>
        {/* Dynamic-island style pill. */}
        <div className="absolute left-1/2 top-[15px] h-[16px] w-[52px] -translate-x-1/2 rounded-full bg-ink lg:top-[18px] lg:w-[62px]" />
      </div>
    </div>
  );
}
