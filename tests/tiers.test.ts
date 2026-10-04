import { test } from "node:test";
import assert from "node:assert/strict";
import { spendRatio, tierFor } from "@/lib/tiers";

const B = 350000;

test("a finished month is judged on total spend against the budget", () => {
  assert.equal(tierFor(spendRatio(150000, B, false)).key, "under");
  assert.equal(tierFor(spendRatio(280000, B, false)).key, "good");
  assert.equal(tierFor(spendRatio(350000, B, false)).key, "close");   // exactly on budget
  assert.equal(tierFor(spendRatio(400000, B, false)).key, "over");
  assert.equal(tierFor(spendRatio(512338, B, false)).key, "well-over"); // Sept 2026 dev, 146%
  assert.equal(tierFor(spendRatio(1417004, B, false)).key, "way-over"); // Sept 2026 live, 405%
});

test("a running month is judged against the pace so far", () => {
  // Half the month gone, half the budget spent: right on pace.
  assert.equal(tierFor(spendRatio(175000, B, true, 0.5)).key, "close");
  // Same spend at the 80% mark is comfortable.
  assert.equal(tierFor(spendRatio(175000, B, true, 0.8)).key, "good");
});

test("early in the month, one bill doesn't paint it dark red", () => {
  // Rs 1 lakh on day 2 (pace ~7%) is measured against a third of the budget.
  assert.equal(tierFor(spendRatio(100000, B, true, 0.07)).key, "close");
});

test("no budget, no judgement", () => {
  assert.equal(spendRatio(100000, 0, false), 0);
});

test("budget alerts take their tier's colour from the link", async () => {
  const { alertTone } = await import("@/lib/tiers");
  assert.match(alertTone("/?m=2026-10&alert=way-over") ?? "", /tier-darkred/);
  assert.equal(alertTone("/ledger"), null);
});
