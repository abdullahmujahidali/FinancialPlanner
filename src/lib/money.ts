/** PKR formatting the way the household thinks: lakh and crore. */
export function pkr(n: number | string, opts: { compact?: boolean } = {}) {
  const v = typeof n === "string" ? Number(n) : n;
  if (!isFinite(v)) return "—";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (opts.compact) {
    if (a >= 1e7) return `${sign}${trim(a / 1e7)} Cr`;
    if (a >= 1e5) return `${sign}${trim(a / 1e5)} L`;
    if (a >= 1e3) return `${sign}${trim(a / 1e3)}k`;
  }
  return sign + new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(a);
}
const trim = (x: number) => (Math.round(x * 100) / 100).toString();

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const from = `${y}-${String(mo).padStart(2, "0")}-01`;
  const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return { from, next };
}
export function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
