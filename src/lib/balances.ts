import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";

/**
 * What the household actually has, as opposed to what it owns.
 *
 * Assets answer "what is the plot worth". This answers "how much money is
 * there", which the ledger alone cannot: a ledger records movement, not
 * position. Given an opening balance per account, the rest is derivable —
 * every rupee in or out since that date is already recorded.
 *
 * Transfers are the subtle part. They are not spend, but they do move money
 * between two accounts, so each one is a debit to `accountId` and a credit to
 * `counterAccountId`. Netted across the household they cancel to zero, which
 * is exactly right: moving cash from the bank to a wallet changes neither the
 * total nor the household's wealth.
 */

export type AccountBalance = {
  id: number;
  name: string;
  kind: string;
  /** Null when no opening balance has been set — unknown, not zero. */
  balance: number | null;
  opening: number | null;
  openingDate: string | null;
  /** Net movement since the opening date, whether or not opening is known. */
  movement: number;
};

export async function getBalances(householdId: number): Promise<{
  accounts: AccountBalance[];
  /** Sum of the accounts whose balance is known. */
  total: number;
  /** True when at least one active account has no opening balance set. */
  incomplete: boolean;
}> {
  const accounts = await db()
    .select()
    .from(t.accounts)
    .where(and(eq(t.accounts.householdId, householdId), eq(t.accounts.isArchived, false)))
    .orderBy(t.accounts.id);

  if (accounts.length === 0) return { accounts: [], total: 0, incomplete: false };

  /**
   * Movement per account in one grouped pass rather than a query per account.
   * `direction` folds the three types plus both sides of a transfer into a
   * single signed sum.
   */
  const rows = await db()
    .select({
      accountId: t.transactions.accountId,
      counterAccountId: t.transactions.counterAccountId,
      type: t.transactions.type,
      amount: t.transactions.amount,
      txDate: t.transactions.txDate
    })
    .from(t.transactions)
    .where(eq(t.transactions.householdId, householdId));

  const movement = new Map<number, number>();
  const bump = (id: number | null, v: number) => {
    if (id == null) return;
    movement.set(id, (movement.get(id) ?? 0) + v);
  };

  const openingOf = new Map(accounts.map((a) => [a.id, a.openingDate]));
  /** Movement before an account's opening date is already inside that figure. */
  const counts = (accountId: number | null, txDate: string) => {
    if (accountId == null) return false;
    const from = openingOf.get(accountId);
    return !from || txDate >= from;
  };

  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.type === "income") {
      if (counts(r.accountId, r.txDate)) bump(r.accountId, amt);
    } else if (r.type === "expense") {
      if (counts(r.accountId, r.txDate)) bump(r.accountId, -amt);
    } else if (r.type === "transfer") {
      // Out of one account, into the other.
      if (counts(r.accountId, r.txDate)) bump(r.accountId, -amt);
      if (counts(r.counterAccountId, r.txDate)) bump(r.counterAccountId, amt);
    }
  }

  const out: AccountBalance[] = accounts.map((a) => {
    const move = movement.get(a.id) ?? 0;
    const opening = a.openingBalance == null ? null : Number(a.openingBalance);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      opening,
      openingDate: a.openingDate,
      movement: move,
      balance: opening == null ? null : opening + move
    };
  });

  const known = out.filter((a) => a.balance != null);
  return {
    accounts: out,
    total: known.reduce((s, a) => s + (a.balance ?? 0), 0),
    incomplete: known.length < out.length
  };
}

/** Latest value of every active asset — the other half of net worth. */
export async function getAssetTotal(householdId: number): Promise<number> {
  const rows = await db()
    .select({
      id: t.assets.id,
      purchasePrice: t.assets.purchasePrice,
      latest: sql<string | null>`(
        select av.value from ${t.assetValues} av
        where av.asset_id = ${t.assets.id}
        order by av.valued_on desc, av.id desc
        limit 1
      )`
    })
    .from(t.assets)
    .where(and(eq(t.assets.householdId, householdId), eq(t.assets.status, "active")));

  return rows.reduce(
    (s, a) => s + Number(a.latest ?? a.purchasePrice),
    0
  );
}
