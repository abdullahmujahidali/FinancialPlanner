import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMeezan } from "@/lib/meezan";
import { classifyRows, type Rule } from "@/lib/rules";

// Shape of a real Meezan export: preamble, then the Booking Date header.
const CSV = [
  "Account Statement,,,,,,",
  "Opening Balance,500000.00,,,,,",
  "Closing Balance,413500.00,,,,,",
  "Booking Date,Value Date,Doc No,Description,Debit,Credit,Balance",
  "01 Oct 2026,01 Oct 2026,D1,SALARY OCT 2026,,150000.00,650000.00",
  "02 Oct 2026,02 Oct 2026,D2,ATM CASH WITHDRAWAL 123,20000.00,,630000.00",
  "02 Oct 2026,02 Oct 2026,D3,\"IMRAN, GROCERY STORE\",15000.00,,615000.00",
  "03 Oct 2026,03 Oct 2026,D4,ADJUSTMENT DEBIT STAN 778899,1500.00,,613500.00",
  "03 Oct 2026,03 Oct 2026,D5,ADJUSTMENT REV STAN 778899,,1500.00,615000.00",
  "04 Oct 2026,04 Oct 2026,D6,LESCO BILL,1500.00,,613500.00",
  "05 Oct 2026,05 Oct 2026,D7,IBFT TO PLOT DEALER,200000.00,,413500.00",
  ""
].join("\n");

test("parses the preamble, rows, quoted commas and dates", () => {
  const p = parseMeezan(CSV, 1, 1);
  assert.deepEqual(p.errors, []);
  assert.equal(p.opening, 500000);
  assert.equal(p.closing, 413500);
  assert.equal(p.rows.length, 7);
  assert.equal(p.rows[0].bookingDate, "2026-10-01");
  assert.equal(p.rows[2].description, "IMRAN, GROCERY STORE");
});

test("balance ties out: opening + credits − debits = closing", () => {
  const p = parseMeezan(CSV, 1, 1);
  const net = p.rows.reduce((s, r) => s + r.credit - r.debit, 0);
  assert.ok(Math.abs(p.opening! + net - p.closing!) < 0.05);
});

test("fingerprints are stable and unique per row, and per household", () => {
  const a = parseMeezan(CSV, 1, 1).rows.map((r) => r.fingerprint);
  const b = parseMeezan(CSV, 1, 1).rows.map((r) => r.fingerprint);
  const other = parseMeezan(CSV, 2, 1).rows.map((r) => r.fingerprint);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  assert.notEqual(a[0], other[0]);
});

test("a statement without the header is refused, not half-read", () => {
  const p = parseMeezan("just,some,csv\n1,2,3", 1, 1);
  assert.equal(p.rows.length, 0);
  assert.equal(p.errors.length, 1);
});

test("classifier: salary, ATM, reversals, rules, and the review queue", () => {
  const rules: Rule[] = [{
    id: 1, pattern: "lesco", setCategoryId: 7, setPersonId: null,
    setPassthrough: true, setAbnormal: false, priority: 10
  }];
  const c = classifyRows(parseMeezan(CSV, 1, 1).rows, rules, 99);
  const by = (desc: string) => c.find((x) => x.row.description.startsWith(desc))!;

  assert.equal(by("SALARY").action, "income");
  assert.equal(by("ATM").action, "transfer_cash");
  assert.equal(by("ADJUSTMENT DEBIT").action, "ignore");
  assert.equal(by("ADJUSTMENT REV").action, "ignore");
  // Reimbursed bill: categorised and kept out of the budget.
  assert.equal(by("LESCO").categoryId, 7);
  assert.equal(by("LESCO").isPassthrough, true);
  assert.equal(by("LESCO").needsReview, false);
  // Unknown spend goes to Tooba's review queue.
  assert.equal(by("IMRAN").action, "expense");
  assert.equal(by("IMRAN").needsReview, true);
});
