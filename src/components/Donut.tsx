import { pkr } from "@/lib/money";

/**
 * Category donut. Alternating lime/black/white segments with hard black
 * separators, total sitting in the middle — the reference's centre screen.
 */
const FILL = ["#E2FB4F", "#0A0A0A", "#FFFFFF", "#E98D7C", "#C9E23F", "#6B6B6B"];

export default function Donut({
  data,
  total,
  label = "Total"
}: {
  data: Array<{ name: string; value: number }>;
  total: number;
  label?: string;
}) {
  const sum = data.reduce((a, d) => a + d.value, 0);
  const R = 88;
  const STROKE = 40;
  const C = 2 * Math.PI * R;

  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = sum > 0 ? d.value / sum : 0;
    const len = frac * C;
    const seg = { d, len, offset, fill: FILL[i % FILL.length] };
    offset += len;
    return seg;
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
        {/* ring base keeps a clean black edge even with a single segment */}
        <circle cx="120" cy="120" r={R} fill="none" stroke="#0A0A0A" strokeWidth={STROKE + 4} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="120"
            cy="120"
            r={R}
            fill="none"
            stroke={s.fill}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(0, s.len - 3)} ${C}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="eyebrow text-muted">{label}</span>
        <span className="money-xl mt-1 text-[30px]">{pkr(total, { compact: true })}</span>
      </div>
    </div>
  );
}
