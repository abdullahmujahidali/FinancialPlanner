/**
 * Income vs expense, month by month. Paired bars: income lime, expense black,
 * the current month hatched — matching the reference's treatment.
 */
export default function BarChart({
  data,
  current
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  current?: string;
}) {
  const peak = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const H = 132;

  return (
    <div className="flex items-end gap-3 sm:gap-5">
      {data.map((d) => {
        const isNow = d.label === current;
        const ih = Math.round((d.income / peak) * H);
        const eh = Math.round((d.expense / peak) * H);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[132px] w-full items-end justify-center gap-1">
              <div
                className="w-full max-w-[26px] border-2 border-line bg-acid"
                style={{ height: Math.max(3, ih) }}
                title={`Income ${d.income.toLocaleString("en-PK")}`}
              />
              <div
                className={"w-full max-w-[26px] border-2 border-line " + (isNow ? "hatch bg-card" : "bg-ink")}
                style={{ height: Math.max(3, eh) }}
                title={`Spent ${d.expense.toLocaleString("en-PK")}`}
              />
            </div>
            <span className={"text-[11px] font-bold " + (isNow ? "text-ink" : "text-muted")}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
