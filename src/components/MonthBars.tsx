import { pkr } from "@/lib/money";

/**
 * Twelve months at a glance: spend counted against the budget as a bar (blush
 * when it went over), one-offs stacked on top in grey so the bar's full height
 * is still the true total,
 * income as a thin lime bar beside it, and the monthly budget as a dashed
 * line. Months with no entries are drawn as an empty slot so the year still
 * reads as a year.
 */
export default function MonthBars({
  months,
  budget,
  current
}: {
  months: Array<{ key: string; label: string; spend: number; oneOff?: number; income: number; hasData: boolean }>;
  budget: number;
  current?: string;
}) {
  const W = 720, H = 200, pad = { t: 14, b: 24, l: 4, r: 4 };
  const peak = Math.max(budget, ...months.map((m) => Math.max(m.spend + (m.oneOff ?? 0), m.income)), 1) * 1.08;
  const slot = (W - pad.l - pad.r) / months.length;
  const y = (v: number) => pad.t + (1 - v / peak) * (H - pad.t - pad.b);
  const base = y(0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Spend and income by month">
        <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} className="stroke-line" />
        {budget > 0 && (
          <>
            <line x1={pad.l} x2={W - pad.r} y1={y(budget)} y2={y(budget)} className="stroke-muted/60" strokeDasharray="5 5" />
            <text x={W - pad.r} y={y(budget) - 5} textAnchor="end" className="fill-muted text-[11px] font-bold">
              budget {pkr(budget, { compact: true })}
            </text>
          </>
        )}
        {months.map((m, i) => {
          const x0 = pad.l + i * slot;
          const bw = Math.min(26, slot * 0.36);
          const over = budget > 0 && m.spend > budget;
          return (
            <g key={m.key}>
              {m.hasData ? (
                <>
                  <rect x={x0 + slot / 2 - bw - 1} y={y(m.spend)} width={bw} height={base - y(m.spend)} rx={4}
                    className={over ? "fill-blush" : "fill-ink"}>
                    <title>{`${m.label}: ${pkr(m.spend)} counted against budget`}</title>
                  </rect>
                  {(m.oneOff ?? 0) > 0 && (
                    <rect x={x0 + slot / 2 - bw - 1} y={y(m.spend + m.oneOff!)} width={bw} height={y(m.spend) - y(m.spend + m.oneOff!)} rx={4}
                      className="fill-muted/35">
                      <title>{`${m.label}: ${pkr(m.oneOff!)} in one-offs`}</title>
                    </rect>
                  )}
                  <rect x={x0 + slot / 2 + 1} y={y(m.income)} width={bw * 0.6} height={base - y(m.income)} rx={3} className="fill-acid">
                    <title>{`${m.label}: income ${pkr(m.income)}`}</title>
                  </rect>
                </>
              ) : (
                <rect x={x0 + slot / 2 - bw / 2} y={base - 3} width={bw} height={3} rx={1.5} className="fill-line" />
              )}
              <text x={x0 + slot / 2} y={H - 6} textAnchor="middle"
                className={"text-[11px] font-bold " + (m.key === current ? "fill-ink" : "fill-muted")}>{m.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-ink" />Spent</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blush" />Over budget</span>
        {months.some((m) => (m.oneOff ?? 0) > 0) && (
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-muted/35" />One-offs</span>
        )}
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-acid" />Income</span>
      </div>
    </div>
  );
}
