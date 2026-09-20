"use client";
import { useState } from "react";
import { pkr, setCurrency } from "@/lib/money";
import { DONUT_COLORS } from "@/lib/palette";

/**
 * Category donut with hover detail.
 *
 * Colour is assigned by RANK, not by hashing the name — the largest slice
 * always takes the strongest colour and each step down is visually distinct, so
 * the legend reads as an ordered scale instead of arbitrary confetti. Hovering
 * a slice (or a legend row, via `activeIndex`) lifts it and swaps the centre
 * figure for that category's own total.
 */

export default function Donut({
  data,
  total,
  label = "Total",
  currency
}: {
  data: Array<{ name: string; value: number }>;
  total: number;
  label?: string;
  /**
   * The household's currency. `setCurrency` is module-level state set on the
   * server during the request; this component is a client one, so its own
   * bundle would otherwise keep the PKR default and print "Rs" for every
   * household. Passing the code in re-points the formatter on the client too.
   */
  currency?: string | null;
}) {
  setCurrency(currency);
  const [active, setActive] = useState<number | null>(null);

  const sum = data.reduce((a, d) => a + d.value, 0);
  const R = 84;
  const C = 2 * Math.PI * R;
  const GAP = 2.5;

  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = sum > 0 ? d.value / sum : 0;
    const len = frac * C;
    const seg = { ...d, len, offset, fill: DONUT_COLORS[i % DONUT_COLORS.length], frac };
    offset += len;
    return seg;
  });

  const shown = active !== null ? segments[active] : null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px] [container-type:inline-size]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
        {segments.map((s, i) => {
          const isActive = active === i;
          return (
            <circle
              key={i}
              cx="120"
              cy="120"
              r={R}
              fill="none"
              stroke={s.fill}
              // the hovered slice thickens outward, so it reads as lifted
              strokeWidth={isActive ? 54 : 46}
              strokeDasharray={`${Math.max(0, s.len - GAP)} ${C}`}
              strokeDashoffset={-s.offset}
              opacity={active === null || isActive ? 1 : 0.35}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${s.name} — ${pkr(s.value)} (${Math.round(s.frac * 100)}%)`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22%] text-center">
        {shown ? (
          <>
            <span className="eyebrow line-clamp-2 text-ink/60">{shown.name}</span>
            <span className="money-xl mt-1.5 text-[clamp(15px,7cqw,26px)] leading-tight">{pkr(shown.value, { compact: true })}</span>
            <span className="mt-1 text-[12px] font-bold text-ink/55">
              {Math.round(shown.frac * 100)}% of spend
            </span>
          </>
        ) : (
          <>
            <span className="eyebrow text-ink/50">{label}</span>
            <span className="money-xl mt-1.5 text-[clamp(16px,7.5cqw,28px)] leading-tight">{pkr(total, { compact: true })}</span>
          </>
        )}
      </div>
    </div>
  );
}
