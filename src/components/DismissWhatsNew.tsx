"use client";
import { useState } from "react";

/** Hides the banner at once and remembers it on this device for a year. */
export default function DismissWhatsNew({ id, children }: { id: string; children: React.ReactNode }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[20px] bg-ink px-4 py-3 text-white lg:mb-5 lg:px-5">
      {children}
      <button
        onClick={() => {
          document.cookie = `seen=${id}; path=/; max-age=31536000; samesite=lax`;
          setGone(true);
        }}
        className="shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-[12.5px] font-bold transition hover:bg-white/20"
      >
        Got it
      </button>
    </div>
  );
}
