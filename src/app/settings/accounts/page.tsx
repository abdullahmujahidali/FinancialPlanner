import SettingsPage from "@/components/SettingsPage";
import EditableRow from "@/components/EditableRow";
import OpeningBalance from "@/components/OpeningBalance";
import { getBalances } from "@/lib/balances";
import { pkr } from "@/lib/money";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { addAccount, renameAccount, setAccountArchived, setOpeningBalance } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Accounts: the places money actually sits.
 *
 * The add-form sits above the list: adding is why the page gets opened, and
 * below a list of accounts it was a scroll away. Archived accounts move to
 * their own section rather than vanishing — a closed account still has
 * history worth reading.
 */
export default async function AccountsSettings() {
  const { household } = await requireContext();

  const accounts = await db()
    .select()
    .from(t.accounts)
    .where(eq(t.accounts.householdId, household.id))
    .orderBy(asc(t.accounts.id));

  const { accounts: balances, total, incomplete } = await getBalances(household.id);
  const balanceOf = new Map(balances.map((b) => [b.id, b]));

  const live = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  return (
    <SettingsPage
      title="Accounts"
      description="Accounts are where money sits — each bank account plus the cash wallet you carry. Archiving hides an account you no longer use without deleting any of its history."
    >
      {/* The number the whole page exists to produce. */}
      <div className="zone-ink mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-white/45">Money on hand</span>
          {incomplete && (
            <span className="text-[11px] font-bold text-blush">some balances not set</span>
          )}
        </div>
        <div className="money-xl mt-3 text-[38px] text-acid lg:text-[46px]">{pkr(total)}</div>
        <p className="mt-2 text-[12.5px] font-medium text-white/55">
          {incomplete
            ? "Set an opening balance on each account below and this becomes the real figure."
            : "Across every active account, kept current by the ledger."}
        </p>
      </div>

      <form action={addAccount} className="mb-4 flex items-center gap-3 rounded-[22px] bg-card p-5 lg:p-6">
        <input
          name="name"
          placeholder="e.g. Savings account"
          className="field min-w-0 flex-1"
          required
        />
        <select
          name="kind"
          aria-label="Account kind"
          className="field shrink-0 basis-[110px] [width:110px]"
        >
          <option value="bank">bank</option>
          <option value="cash">cash</option>
        </select>
        <button className="btn shrink-0 gap-1.5 px-4">
          <Plus size={17} strokeWidth={2.75} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      <div className="overflow-hidden rounded-[22px] bg-card">
        {live.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No accounts yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Add the bank accounts and wallets your household actually uses.
            </p>
          </div>
        ) : (
          <ul>
            {live.map((a) => {
              const b = balanceOf.get(a.id);
              return (
                <li key={a.id} className="rule-row last:border-0">
                  <ul>
                    <EditableRow
                      id={a.id}
                      name={a.name}
                      renameAction={renameAccount}
                      /* Cash is where ATM withdrawals land; archiving it would
                         break transfers, so it stays put. */
                      archiveAction={a.kind === "cash" ? undefined : setAccountArchived}
                      badge={
                        <span className="flex shrink-0 items-center gap-2">
                          {b?.balance != null && (
                            <span className="money text-[14px] font-bold">{pkr(b.balance)}</span>
                          )}
                          <span className="tag-muted">{a.kind}</span>
                        </span>
                      }
                    />
                  </ul>
                  <OpeningBalance
                    id={a.id}
                    name={a.name}
                    kind={a.kind}
                    opening={b?.opening ?? null}
                    openingDate={b?.openingDate ?? null}
                    movement={b?.movement ?? 0}
                    balance={b?.balance ?? null}
                    action={setOpeningBalance}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="eyebrow mt-8 mb-3 text-muted">Archived · {archived.length}</h2>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <ul>
              {archived.map((a) => (
                <EditableRow
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  archived
                  renameAction={renameAccount}
                  archiveAction={setAccountArchived}
                  badge={<span className="tag-muted shrink-0">{a.kind}</span>}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </SettingsPage>
  );
}
