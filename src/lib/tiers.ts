/**
 * Where a month stands, as one of six colours.
 *
 * Measured on TOTAL spend, one-offs included: the incentive may leave one-offs
 * out, but the colour answers "how did the household do", and a green month
 * at four times the budget would be a lie.
 *
 * A finished month compares spend with the budget. A running month compares
 * it with where an even pace would be by today — Rs 1.5 lakh on the 10th is
 * already a lot — but never with less than a third of the budget, so one big
 * bill on the 2nd doesn't paint the whole month dark red.
 */

export type Tier = {
  key: "under" | "good" | "close" | "over" | "well-over" | "way-over";
  label: string;
  /** Pill, bar and accent colour classes (tokens in globals.css). */
  bg: string;
  text: string;
};

const TIERS: Array<Tier & { upTo: number }> = [
  { upTo: 0.5, key: "under", label: "Well under", bg: "bg-tier-blue", text: "text-white" },
  { upTo: 0.85, key: "good", label: "Comfortable", bg: "bg-tier-green", text: "text-white" },
  { upTo: 1, key: "close", label: "Close to the line", bg: "bg-tier-yellow", text: "text-ink" },
  { upTo: 1.25, key: "over", label: "Over", bg: "bg-tier-orange", text: "text-ink" },
  { upTo: 1.75, key: "well-over", label: "Well over", bg: "bg-tier-red", text: "text-white" },
  { upTo: Infinity, key: "way-over", label: "Way over", bg: "bg-tier-darkred", text: "text-white" }
];

/** Spend as a share of what was "allowed" so far (see above). */
export function spendRatio(spend: number, budget: number, running: boolean, monthGone = 1) {
  if (budget <= 0) return 0;
  const allowed = budget * (running ? Math.max(1 / 3, Math.min(1, monthGone)) : 1);
  return spend / allowed;
}

export function tierFor(ratio: number): Tier {
  const t = TIERS.find((x) => ratio <= x.upTo) ?? TIERS[TIERS.length - 1];
  const { upTo: _upTo, ...tier } = t;
  return tier;
}

/**
 * The colour of a budget alert, from the tier kept in its link
 * (`/?m=2026-10&alert=over`, see budget-alerts.ts). Null for anything else.
 */
export function alertTone(href: string | null | undefined) {
  const key = href?.split("alert=")[1];
  const t = TIERS.find((x) => x.key === key);
  return t ? `${t.bg} ${t.text}` : null;
}
