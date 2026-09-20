import { pkr } from "@/lib/money";

/**
 * Income vs expense, month by month.
 *
 * Bars alone say nothing — two coloured rectangles with no scale and no
 * figures can't be read. Each month prints its own in/out amounts under the
 * label, and a faint baseline plus a peak marker give the heights a reference.
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
    <div>
      {/* Scale reference: without it the tallest bar could be any number. */}
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-bold text-muted">
        <span>{pkr(peak, { compact: true })}</span>
        <span className="text-muted/60">peak</span>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-line" />
        <div className="absolute inset-x-0 top-1/2 border-t border-line" />

        <div className="relative flex items-end gap-4 border-b border-line sm:gap-7" style={{ minHeight: H }}>
          {data.map((d) => {
            const isNow = d.label === current;
            const ih = Math.round((d.income / peak) * H);
            const eh = Math.round((d.expense / peak) * H);
            return (
              <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-0">
                <div className="flex w-full items-end justify-center gap-1.5" style={{ height: H }}>
                  <div
                    className="w-full max-w-[26px] rounded-t-[6px] bg-acid"
                    style={{ height: Math.max(4, ih) }}
                    title={`Income ${pkr(d.income)}`}
                  />
                  <div
                    className={"w-full max-w-[26px] rounded-t-[6px] " + (isNow ? "hatch bg-page" : "bg-ink")}
                    style={{ height: Math.max(4, eh) }}
                    title={`Spent ${pkr(d.expense)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The numbers the bars stand for, so the chart is readable without hovering. */}
      <div className="flex gap-4 sm:gap-7">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1 pt-2.5">
            <span className={"text-[12px] font-bold " + (d.label === current ? "text-ink" : "text-muted")}>
              {d.label}
            </span>
            <span className="num text-[11px] font-bold leading-tight text-ink">
              {pkr(d.income, { compact: true })} in
            </span>
            <span className="num text-[11px] font-semibold leading-tight text-muted">
              {pkr(d.expense, { compact: true })} out
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
