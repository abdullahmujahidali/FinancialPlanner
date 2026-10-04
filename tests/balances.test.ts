import { test } from "node:test";
import assert from "node:assert/strict";
import { accountMovement } from "@/lib/balances";

const MEEZAN = 1;
const CASH = 2;
const row = (r: Partial<Parameters<typeof accountMovement>[0][number]>) => ({
  accountId: MEEZAN, counterAccountId: null, type: "expense", amount: "0", txDate: "2026-10-01", ...r
});

test("income adds, expense subtracts, a refund adds back", () => {
  const m = accountMovement([
    row({ type: "income", amount: "300000" }),
    row({ type: "expense", amount: "45000" }),
    row({ type: "expense", amount: "-5000" })
  ], new Map());
  assert.equal(m.get(MEEZAN), 260000);
});

test("an ATM withdrawal moves money without changing the total", () => {
  const m = accountMovement([row({ type: "transfer", amount: "20000", counterAccountId: CASH })], new Map());
  assert.equal(m.get(MEEZAN), -20000);
  assert.equal(m.get(CASH), 20000);
});

test("loan repayments: paid out lowers the balance, received raises it", () => {
  const m = accountMovement([
    row({ type: "transfer", amount: "100000" }), // token to the plot dealer
    row({ type: "transfer", amount: "-50000" })  // a loan repaid to us
  ], new Map());
  assert.equal(m.get(MEEZAN), -50000);
});

test("movement before the opening date is already in the opening balance", () => {
  const m = accountMovement([
    row({ type: "expense", amount: "1000", txDate: "2026-08-31" }),
    row({ type: "expense", amount: "2000", txDate: "2026-09-01" })
  ], new Map([[MEEZAN, "2026-09-01"]]));
  assert.equal(m.get(MEEZAN), -2000);
});
