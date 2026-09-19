import type { StatementRow } from "./meezan";

export type Rule = {
  id: number; pattern: string;
  setCategoryId: number | null; setPersonId: number | null;
  setPassthrough: boolean; setAbnormal: boolean; priority: number;
};
export type Classified = {
  row: StatementRow;
  action: "expense" | "income" | "transfer_cash" | "ignore";
  categoryId: number | null;
  personId: number | null;
  isPassthrough: boolean;
  isAbnormal: boolean;
  needsReview: boolean;
  note: string | null;
};

const REVERSAL = /ADJUSTMENT\s+(REV|DEBIT)\b.*?(\d{4,})/i;

/**
 * Classify statement rows:
 * 1. Pair ADJUSTMENT Rev/Debit reversals -> both ignored.
 * 2. Built-ins: bank charges -> fees; ATM withdrawal -> transfer to cash; salary/remittance -> income.
 * 3. Household rules (uppercase substring on description), by priority.
 * 4. Anything left lands in the review queue.
 */
export function classifyRows(rows: StatementRow[], rules: Rule[], feesCategoryId: number | null): Classified[] {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  // reversal pairing
  const revRefs = new Map<string, number>();
  for (const r of rows) {
    const m = r.description.match(REVERSAL);
    if (m) revRefs.set(m[2], (revRefs.get(m[2]) ?? 0) + 1);
  }

  return rows.map((row) => {
    const D = row.description.toUpperCase();
    const base: Classified = {
      row, action: row.credit > 0 ? "income" : "expense",
      categoryId: null, personId: null,
      isPassthrough: false, isAbnormal: false,
      needsReview: false, note: null
    };

    const m = row.description.match(REVERSAL);
    if (m && (revRefs.get(m[2]) ?? 0) >= 2) {
      return { ...base, action: "ignore", note: "Reversal pair — netted out" };
    }
    if (/^CHARGES TAXES/i.test(row.description) || D.includes("BANK CHARGES")) {
      return { ...base, action: "expense", categoryId: feesCategoryId, note: "Bank charges" };
    }
    if (D.includes("ATM CASH WITHDRAWAL")) {
      return { ...base, action: "transfer_cash", note: "Cash withdrawal — moved to cash wallet" };
    }
    if (row.credit > 0 && (D.includes("REMITTANCE FROM") || D.includes("SALARY"))) {
      return { ...base, action: "income", note: "Income" };
    }
    for (const rule of sorted) {
      if (D.includes(rule.pattern.toUpperCase())) {
        return {
          ...base,
          categoryId: rule.setCategoryId,
          personId: rule.setPersonId,
          isPassthrough: rule.setPassthrough,
          isAbnormal: rule.setAbnormal,
          needsReview: rule.setCategoryId == null && base.action === "expense"
        };
      }
    }
    // unmatched: income credits pass with review; expense debits go to review queue
    return { ...base, needsReview: true };
  });
}
