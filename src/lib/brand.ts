/**
 * Every user-visible mention of the product name comes from here.
 *
 * The name changed once already (Hearthbook → Trusses); keeping it in one
 * place means the next change is a single edit rather than a grep across the
 * app, the manifest and the marketing copy.
 */
export const BRAND = {
  /** Display name, as written in prose and headings. */
  name: "Trusses",
  /** Lowercase wordmark, as drawn in the logo lockup. */
  wordmark: "trusses",
  tagline: "the family financial backbone",
  /** One line for <meta description> and the OG card. */
  blurb:
    "A shared ledger for families who actually talk about money. Import your bank statement, agree on what each line was, and watch the month's savings add up.",
  /**
   * A truss carries its load across many members, not one beam — which is the
   * whole argument for a household ledger the family keeps together.
   */
  metaphor:
    "A truss shares the load across every member. So should a household's money."
} as const;
