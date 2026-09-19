/**
 * Twelve paired income/expense bars — one per calendar month.
 *
 * BarChart assumes a handful of months and lets each column breathe; a full
 * year needs thinner bars, a tighter gutter and single-letter labels on phones
 * so all twelve fit without scrolling. The scale is shared across the year, so
 * a quiet month reads as quiet.
 */
export default function YearBars({
  data,
  current
}: {
  data: Array<{ label: string; short: string; income: number; expense: number }>;
  current?: string;
}) {
  const peak = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const H = 150;

  return (
    <div className="flex items-end gap-1.5 sm:gap-3">
      {data.map((d) => {
        const isNow = d.label === current;
        const ih = Math.round((d.income / peak) * H);
        const eh = Math.round((d.expense / peak) * H);
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <div className="flex h-[150px] w-full items-end justify-center gap-[3px] sm:gap-1.5">
              <div
                className="w-full max-w-[18px] rounded-t-[5px] bg-acid"
                style={{ height: Math.max(3, ih) }}
                title={`${d.label} — income ${d.income.toLocaleString("en-PK")}`}
              />
              <div
                className={"w-full max-w-[18px] rounded-t-[5px] " + (isNow ? "hatch bg-page" : "bg-ink")}
                style={{ height: Math.max(3, eh) }}
                title={`${d.label} — spent ${d.expense.toLocaleString("en-PK")}`}
              />
            </div>
            <span className={"text-[11px] font-bold " + (isNow ? "text-ink" : "text-muted")}>
              <span className="sm:hidden">{d.short}</span>
              <span className="hidden sm:inline">{d.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
