import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { f, readForm } from "@/lib/forms";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.append(k, v);
  return fd;
};

test("money: blank, zero, negative and junk are all 'Enter an amount'", () => {
  const s = z.object({ amount: f.money });
  for (const amount of ["", "0", "-5", "abc", "1,000"]) {
    const r = readForm(s, form({ amount }));
    assert.equal(r.ok, false, amount);
    if (!r.ok) assert.equal(r.error, "Enter an amount", amount);
  }
  const ok = readForm(s, form({ amount: "6500000" }));
  assert.deepEqual(ok, { ok: true, data: { amount: 6500000 } });
});

test("money: a typo with too many zeros is refused", () => {
  const r = readForm(z.object({ amount: f.money }), form({ amount: "6500000000000" }));
  assert.equal(r.ok, false);
});

test("dates: blank is 'not given', impossible days are refused", () => {
  const s = z.object({ d: f.optDate });
  assert.deepEqual(readForm(s, form({ d: "" })), { ok: true, data: { d: undefined } });
  assert.deepEqual(readForm(s, form({ d: "2026-10-04" })), { ok: true, data: { d: "2026-10-04" } });
  assert.equal(readForm(s, form({ d: "2026-02-30" })).ok, false);
  assert.equal(readForm(s, form({ d: "04/10/2026" })).ok, false);
});

test("ids and checkboxes", () => {
  const s = z.object({ accountId: f.optId, flag: f.checkbox });
  assert.deepEqual(readForm(s, form({ accountId: "", })), { ok: true, data: { accountId: undefined, flag: false } });
  assert.deepEqual(readForm(s, form({ accountId: "7", flag: "on" })), { ok: true, data: { accountId: 7, flag: true } });
  assert.equal(readForm(s, form({ accountId: "7.5" })).ok, false);
  assert.equal(readForm(s, form({ accountId: "-1" })).ok, false);
});

test("opening balance may be negative (overdrawn), blank clears it", () => {
  const s = z.object({ b: f.optSignedMoney });
  assert.deepEqual(readForm(s, form({ b: "-2500" })), { ok: true, data: { b: -2500 } });
  assert.deepEqual(readForm(s, form({ b: "" })), { ok: true, data: { b: undefined } });
});

test("text is trimmed and capped; required text says why", () => {
  const s = z.object({ name: f.name("Name is required", 5) });
  assert.deepEqual(readForm(s, form({ name: "  Plot " })), { ok: true, data: { name: "Plot" } });
  const r = readForm(s, form({ name: "   " }));
  assert.ok(!r.ok && r.error === "Name is required");
  assert.equal(readForm(s, form({ name: "Too long a name" })).ok, false);
});

test("month keys", () => {
  assert.ok(f.month.safeParse("2026-10").success);
  assert.ok(!f.month.safeParse("2026-13").success);
});
