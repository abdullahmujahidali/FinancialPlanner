/**
 * Release notes, written for the person using the app rather than the person
 * building it. The newest entry is shown once on Home to each person (tracked
 * by the `seen` cookie) until they tap "Got it"; every entry stays on
 * /whats-new. Add new releases at the TOP and give each a new id.
 */
export type Release = {
  id: string;
  date: string;
  title: string;
  items: Array<{ text: string; href?: string }>;
};

export const RELEASES: Release[] = [
  {
    id: "2026-10-02-b",
    date: "2 October 2026",
    title: "One-offs no longer cost the incentive",
    items: [
      {
        text: "Entries flagged one-off (a hospital bill, an aqiqah) still show in total spend, but no longer count against the budget, savings or incentive.",
        href: "/?m=2026-09"
      },
      { text: "Year is now numbers first: spent, income, kept, average per month, incentive earned, and a month-by-month table.", href: "/year" },
      { text: "Insights shows the month as figures — budget used, one-offs, month-end pace — and each finding leads with its number.", href: "/insights" },
      { text: "A cleaner Home: one card style, everything in equal rows." }
    ]
  },
  {
    id: "2026-10-02",
    date: "2 October 2026",
    title: "Your feedback, built in",
    items: [
      {
        text: "Home now says how much you can spend per day to stay in budget, shows a chart of the month against the budget, and lists the latest entries.",
        href: "/"
      },
      {
        text: "Insights answers \"where did the month go\" from a single month — spend against budget, biggest expenses, who it was for, and what was a one-off.",
        href: "/insights"
      },
      {
        text: "Give each category its own budget (e.g. Petrol Rs 40,000). Home shows how much of each is left, and Insights flags any that run over.",
        href: "/settings/budget"
      },
      {
        text: "Regular payments: add the maid, milk or school van once. Each month they appear on Home — tick, adjust the amount, add them all in one tap.",
        href: "/settings/regular"
      },
      {
        text: "New categories like Gifts & Occasions and Household Staff, and you can merge two categories that mean the same thing.",
        href: "/settings/categories"
      },
      {
        text: "The ledger is easier to read: bank descriptions are cleaned up (\"To Ahmad\" instead of account numbers) and each day shows its total.",
        href: "/ledger"
      },
      {
        text: "On the phone, Insights has its own tab at the bottom. Review is in Menu, with a badge when something is waiting.",
      },
      {
        text: "You can change your password in Settings.",
        href: "/settings/password"
      }
    ]
  }
];

export const LATEST = RELEASES[0];
