import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canBeLoanPayment,
  daysApart,
  loanBalance,
  loanTransferAmount,
  pickMatch,
  sameAmount,
  shiftDate
} from "@/lib/match";

test("dates: days apart and shifting cross month ends", () => {
  assert.equal(daysApart("2026-09-29", "2026-10-03"), 4);
  assert.equal(daysApart("2026-10-03", "2026-09-29"), 4);
  assert.equal(shiftDate("2026-10-02", -5), "2026-09-27");
  assert.equal(shiftDate("2026-12-30", 5), "2027-01-04");
});

test("amounts match to the paisa, whatever the sign or string form", () => {
  assert.ok(sameAmount(100000, Number("100000.00")));
  assert.ok(sameAmount(-100000, 100000));
  assert.ok(!sameAmount(100000, 100000.5));
});

test("pickMatch takes the closest date inside the window", () => {
  const rows = [
    { id: 1, amount: 100000, date: "2026-10-01" },
    { id: 2, amount: 100000, date: "2026-10-04" },
    { id: 3, amount: 99999, date: "2026-10-03" }
  ];
  assert.equal(pickMatch(rows, 100000, "2026-10-03")?.id, 2);
  assert.equal(pickMatch(rows, 100000, "2026-10-20"), null, "outside the window");
  assert.equal(pickMatch(rows, 5, "2026-10-03"), null, "no amount match");
});

test("pickMatch breaks a tie on the oldest row", () => {
  const rows = [
    { id: 9, amount: 500, date: "2026-10-02" },
    { id: 4, amount: 500, date: "2026-10-04" }
  ];
  assert.equal(pickMatch(rows, 500, "2026-10-03")?.id, 4);
});

test("a repayment we make is money out; one we receive is money in", () => {
  // Paying the plot dealer: the importer's guess was an expense.
  assert.ok(canBeLoanPayment("owed_by_us", { type: "expense", amount: 100000, counterAccountId: null }));
  assert.ok(!canBeLoanPayment("owed_by_us", { type: "income", amount: 100000, counterAccountId: null }));
  // A refund (negative expense) is never a loan payment.
  assert.ok(!canBeLoanPayment("owed_by_us", { type: "expense", amount: -100000, counterAccountId: null }));
  // Moving money between our own accounts is never a loan payment.
  assert.ok(!canBeLoanPayment("owed_by_us", { type: "transfer", amount: 100000, counterAccountId: 5 }));
  // Abubakar paying us back arrives as income.
  assert.ok(canBeLoanPayment("owed_to_us", { type: "income", amount: 50000, counterAccountId: null }));
  assert.ok(canBeLoanPayment("owed_to_us", { type: "transfer", amount: -50000, counterAccountId: null }));
  assert.ok(!canBeLoanPayment("owed_to_us", { type: "expense", amount: 50000, counterAccountId: null }));
});

test("loan transfers are stored out-positive, in-negative", () => {
  assert.equal(loanTransferAmount("owed_by_us", 100000), 100000);
  assert.equal(loanTransferAmount("owed_to_us", 100000), -100000);
  assert.equal(loanTransferAmount("owed_to_us", -100000), -100000);
});

test("loan balance never goes negative and surfaces overpayment", () => {
  assert.deepEqual(loanBalance(6500000, 100000), { outstanding: 6400000, overpaid: 0 });
  assert.deepEqual(loanBalance(100, 120), { outstanding: 0, overpaid: 20 });
});
