import Link from "next/link";

/**
 * The card system Home, Year and Insights share: one white card, one header,
 * one stat, one bar row. Pages compose these instead of inventing a new block
 * each time — that inconsistency is what made the old pages read as a
 * patchwork.
 */
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={"rounded-[20px] bg-card p-5 lg:p-6 " + className}>{children}</section>;
}

export function CardHead({ title, href, link, right }: { title: string; href?: string; link?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink">{title}</h2>
      {right ?? (href && (
        <Link href={href} className="text-[12px] font-bold text-muted transition hover:text-ink">{link ?? "More"} →</Link>
      ))}
    </div>
  );
}

/** A labelled figure. `tone` colours the value only — status, never decoration. */
export function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className={"money mt-1 truncate text-[20px] font-extrabold lg:text-[22px] " + tone}>{value}</div>
      {sub && <div className="truncate text-[11.5px] font-semibold text-muted">{sub}</div>}
    </div>
  );
}

/** A row of stats split by hairlines on wide screens, a 2-up grid on phones. */
export function StatRow({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const lg = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5", 6: "sm:grid-cols-3 lg:grid-cols-6" }[cols];
  return <div className={"grid grid-cols-2 gap-x-5 gap-y-5 " + lg}>{children}</div>;
}

/** Name, amount, and a bar — the shape of every ranked list. */
export function BarRow({ href, label, value, sub, pct, tone = "bg-ink" }: {
  href?: string; label: string; value: string; sub?: string; pct: number; tone?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="truncate font-semibold">{label}</span>
        <span className="num shrink-0 font-bold">{value}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page">
          <div className={"h-full rounded-full " + tone} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
        {sub && <span className="shrink-0 text-[11.5px] font-bold text-muted">{sub}</span>}
      </div>
    </>
  );
  return <li>{href ? <Link href={href} className="block rounded-[10px] transition hover:opacity-75">{body}</Link> : body}</li>;
}

/** A labelled pill: status at a glance. */
export function Pill({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "bad" | "plain" }) {
  const cls = { good: "bg-acid", warn: "bg-blush/60", bad: "bg-blush", plain: "bg-page text-muted" }[tone];
  return <span className={"rounded-full px-3 py-1 text-[12px] font-bold text-ink " + cls}>{children}</span>;
}
