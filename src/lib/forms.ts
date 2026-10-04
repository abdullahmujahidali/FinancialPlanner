import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db/client";

/**
 * Form input, checked before it touches the database.
 *
 * Server actions receive whatever the browser posts. `Number("")` is 0,
 * `Number("1,000")` is NaN and a mangled date string becomes a 500 from
 * Postgres — so every money, date and id field goes through one of these.
 */

/** Ten thousand crore. Anything bigger in a household ledger is a typo. */
export const MAX_MONEY = 100_000_000_000;

const blank = (v: unknown) => (v === "" || v == null ? undefined : v);

/** "2026-02-30" passes a regex but is not a day; round-tripping catches it. */
function isRealDate(s: string) {
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").refine(isRealDate, "Pick a real date");

export const f = {
  /** A positive amount; blank or zero is "enter an amount". */
  money: z.coerce
    .number({ error: "Enter an amount" })
    .finite("Enter an amount")
    .positive("Enter an amount")
    .max(MAX_MONEY, "That amount is too large"),
  /** Blank means not given; zero is allowed. */
  optMoney: z.preprocess(blank, z.coerce.number().finite().min(0).max(MAX_MONEY).optional()),
  /** Can go below zero — an overdrawn account's opening balance. */
  optSignedMoney: z.preprocess(blank, z.coerce.number().finite().min(-MAX_MONEY).max(MAX_MONEY).optional()),
  id: z.coerce.number().int().positive(),
  optId: z.preprocess(blank, z.coerce.number().int().positive().optional()),
  date,
  optDate: z.preprocess(blank, date.optional()),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** Trimmed free text, never null; `max` keeps a pasted essay out. */
  text: (max = 200) => z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(max)),
  /** Required free text. */
  name: (message: string, max = 120) =>
    z.preprocess((v) => (v == null ? "" : v), z.string().trim().min(1, message).max(max)),
  /** An HTML checkbox posts "on" when ticked and nothing at all otherwise. */
  checkbox: z.preprocess((v) => v === "on", z.boolean()),
  pct: z.coerce.number().finite().min(0).max(100)
};

export type FormResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Validate a submitted form. Repeated keys keep their first value. */
export function readForm<S extends z.ZodType>(schema: S, formData: FormData): FormResult<z.infer<S>> {
  const raw: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) if (!(k in raw)) raw[k] = v;
  const res = schema.safeParse(raw);
  if (res.success) return { ok: true, data: res.data };
  return { ok: false, error: res.error.issues[0]?.message ?? "Check the form and try again" };
}

/**
 * True when every given account, category and person belongs to this
 * household. Ids come from the browser, so without this a crafted post could
 * hang a row on another family's account. Nulls and undefined are skipped.
 */
export async function ownsRefs(
  householdId: number,
  refs: {
    accountIds?: Array<number | null | undefined>;
    categoryIds?: Array<number | null | undefined>;
    personIds?: Array<number | null | undefined>;
  }
) {
  const uniq = (xs?: Array<number | null | undefined>) =>
    [...new Set((xs ?? []).filter((x): x is number => typeof x === "number"))];
  const checks: Array<Promise<boolean>> = [];

  const accountIds = uniq(refs.accountIds);
  if (accountIds.length) {
    checks.push(
      db().select({ id: t.accounts.id }).from(t.accounts)
        .where(and(eq(t.accounts.householdId, householdId), inArray(t.accounts.id, accountIds)))
        .then((r) => r.length === accountIds.length)
    );
  }
  const categoryIds = uniq(refs.categoryIds);
  if (categoryIds.length) {
    checks.push(
      db().select({ id: t.categories.id }).from(t.categories)
        .where(and(eq(t.categories.householdId, householdId), inArray(t.categories.id, categoryIds)))
        .then((r) => r.length === categoryIds.length)
    );
  }
  const personIds = uniq(refs.personIds);
  if (personIds.length) {
    checks.push(
      db().select({ id: t.persons.id }).from(t.persons)
        .where(and(eq(t.persons.householdId, householdId), inArray(t.persons.id, personIds)))
        .then((r) => r.length === personIds.length)
    );
  }
  return (await Promise.all(checks)).every(Boolean);
}
