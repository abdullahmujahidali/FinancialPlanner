/**
 * Money formatting.
 *
 * South-Asian currencies are written the way the household thinks — lakh and
 * crore — while everything else uses standard thousands grouping. The locale
 * follows the currency so separators and digit grouping match.
 */
type Money = { symbol: string; locale: string; lakh: boolean };

const CURRENCIES: Record<string, Money> = {
  PKR: { symbol: "Rs", locale: "en-PK", lakh: true },
  INR: { symbol: "₹", locale: "en-IN", lakh: true },
  USD: { symbol: "$", locale: "en-US", lakh: false },
  EUR: { symbol: "€", locale: "en-IE", lakh: false },
  GBP: { symbol: "£", locale: "en-GB", lakh: false },
  AED: { symbol: "AED", locale: "en-AE", lakh: false },
  SAR: { symbol: "SAR", locale: "en-SA", lakh: false },
  CAD: { symbol: "C$", locale: "en-CA", lakh: false },
  AUD: { symbol: "A$", locale: "en-AU", lakh: false }
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

/** PKR is the default: this started as one Pakistani household's ledger. */
let current: Money = CURRENCIES.PKR;

/**
 * Point the formatters at a household's currency. Called once per request from
 * the layout, before anything renders.
 */
export function setCurrency(code?: string | null) {
  current = CURRENCIES[String(code || "PKR").toUpperCase()] ?? CURRENCIES.PKR;
}

export function currencySymbol(code?: string | null) {
  return (CURRENCIES[String(code || "PKR").toUpperCase()] ?? CURRENCIES.PKR).symbol;
}

/**
 * Format an amount in the household's currency.
 *
 * `bare: true` drops the symbol for places that already say what the unit is
 * (a column header, a field labelled "Amount (PKR)"). Everywhere else the
 * symbol is shown — a ledger of unlabelled numbers is ambiguous the moment a
 * second currency exists.
 */
export function pkr(n: number | string, opts: { compact?: boolean; bare?: boolean } = {}) {
  const v = typeof n === "string" ? Number(n) : n;
  if (!isFinite(v)) return "—";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  const sym = opts.bare ? "" : current.symbol + " ";

  if (opts.compact) {
    if (current.lakh) {
      if (a >= 1e7) return `${sign}${sym}${trim(a / 1e7)} crore`;
      if (a >= 1e5) return `${sign}${sym}${trim(a / 1e5)} lakh`;
    } else {
      if (a >= 1e9) return `${sign}${sym}${trim(a / 1e9)}B`;
      if (a >= 1e6) return `${sign}${sym}${trim(a / 1e6)}M`;
    }
    if (a >= 1e3) return `${sign}${sym}${trim(a / 1e3)}k`;
  }
  return sign + sym + new Intl.NumberFormat(current.locale, { maximumFractionDigits: 0 }).format(a);
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
  return new Date(y, mo - 1, 1).toLocaleDateString(current.locale, { month: "long", year: "numeric" });
}
export function monthLabelShort(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(current.locale, { month: "short", year: "numeric" });
}
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
