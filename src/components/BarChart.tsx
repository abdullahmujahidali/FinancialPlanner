/**
 * Income vs expense, month by month. Paired rounded bars: income lime,
 * expense black, the current month hatched — as in the reference.
 */
export default function BarChart({
  data,
  current
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  current?: string;
}) {
  const peak = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const H = 150;

  return (
    <div className="flex items-end gap-4 sm:gap-7">
      {data.map((d) => {
        const isNow = d.label === current;
        const ih = Math.round((d.income / peak) * H);
        const eh = Math.round((d.expense / peak) * H);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-[150px] w-full items-end justify-center gap-1.5">
              <div
                className="w-full max-w-[26px] rounded-t-[6px] bg-acid"
                style={{ height: Math.max(4, ih) }}
                title={`Income ${d.income.toLocaleString("en-PK")}`}
              />
              <div
                className={"w-full max-w-[26px] rounded-t-[6px] " + (isNow ? "hatch bg-page" : "bg-ink")}
                style={{ height: Math.max(4, eh) }}
                title={`Spent ${d.expense.toLocaleString("en-PK")}`}
              />
            </div>
            <span className={"text-[12px] font-bold " + (isNow ? "text-ink" : "text-muted")}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
