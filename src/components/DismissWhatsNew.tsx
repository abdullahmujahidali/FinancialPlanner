"use client";
import { useState } from "react";
import Link from "next/link";

/** Hides the card at once and remembers it on this device for a year. */
export default function DismissWhatsNew({ id, children }: { id: string; children: React.ReactNode }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="relative">
      {children}
      <div className="-mt-px flex items-center justify-between gap-3 rounded-b-[22px] bg-ink px-6 pb-5 lg:px-7">
        <Link href="/whats-new" className="text-[12.5px] font-bold text-white/50 hover:text-white">All updates</Link>
        <button
          onClick={() => {
            document.cookie = `seen=${id}; path=/; max-age=31536000; samesite=lax`;
            setGone(true);
          }}
          className="rounded-full bg-acid px-5 py-2 text-[13px] font-bold text-ink transition hover:bg-aciddim"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
