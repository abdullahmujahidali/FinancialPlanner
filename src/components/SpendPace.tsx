import { pkr } from "@/lib/money";

/**
 * The month as a race against the budget: running spend day by day, against a
 * straight line from zero to the budget, with last month's run behind it in
 * grey. Answers "are we ahead or behind?" at a glance, which a single total
 * cannot — Rs 1.2 lakh is fine on the 25th and alarming on the 5th.
 */
export default function SpendPace({
  daily,
  lastDaily,
  budget,
  daysInMonth,
  today
}: {
  /** Cumulative spend at the end of each day, index 0 = day 1. */
  daily: number[];
  lastDaily: number[] | null;
  budget: number;
  daysInMonth: number;
  /** Last day to draw for this month (today, or the month's end). */
  today: number;
}) {
  const W = 600;
  const H = 190;
  const pad = { l: 4, r: 4, t: 12, b: 22 };
  const peak = Math.max(budget, ...daily, ...(lastDaily ?? []), 1) * 1.05;
  const x = (day: number) => pad.l + ((day - 1) / Math.max(1, daysInMonth - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / peak) * (H - pad.t - pad.b);
  const path = (pts: number[], upto: number) =>
    pts.slice(0, upto).map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const now = daily[Math.max(0, today - 1)] ?? 0;
  const ideal = budget > 0 ? (budget * today) / daysInMonth : 0;
  const ahead = budget > 0 ? ideal - now : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Spent ${pkr(now)} by day ${today}; the budget pace for that day is ${pkr(Math.round(ideal))}.`}>
        {budget > 0 && (
          <>
            <line x1={x(1)} y1={y(0)} x2={x(daysInMonth)} y2={y(budget)}
              className="stroke-muted/50" strokeWidth={1.5} strokeDasharray="5 5" />
            <line x1={pad.l} x2={W - pad.r} y1={y(budget)} y2={y(budget)} className="stroke-line" strokeWidth={1} />
            <text x={W - pad.r} y={y(budget) - 4} textAnchor="end" className="fill-muted text-[11px] font-bold">
              budget {pkr(budget, { compact: true })}
            </text>
          </>
        )}
        {lastDaily && (
          <path d={path(lastDaily, Math.min(lastDaily.length, daysInMonth))} fill="none"
            className="stroke-muted/40" strokeWidth={2} strokeLinejoin="round" />
        )}
        {today > 0 && (
          <>
            <path d={`${path(daily, today)} L${x(today).toFixed(1)},${y(0)} L${x(1)},${y(0)} Z`}
              className="fill-acid/50" />
            <path d={path(daily, today)} fill="none" className="stroke-ink" strokeWidth={3}
              strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(today)} cy={y(now)} r={5} className="fill-ink" />
          </>
        )}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="stroke-line" strokeWidth={1} />
        {[1, 8, 15, 22, daysInMonth].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor={d === 1 ? "start" : d === daysInMonth ? "end" : "middle"}
            className="fill-muted text-[11px] font-bold">{d}</text>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded bg-ink" /> This month</span>
        {lastDaily && <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded bg-muted/40" /> Last month</span>}
        {budget > 0 && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-muted/50" /> Budget pace</span>}
      </div>

      {budget > 0 && today > 0 && (
        <p className="mt-3 text-[14px] font-semibold">
          {ahead >= 0
            ? `${pkr(Math.round(ahead))} under where the budget expects by day ${today}.`
            : `${pkr(Math.round(-ahead))} over where the budget expects by day ${today}.`}
        </p>
      )}
    </div>
  );
}
