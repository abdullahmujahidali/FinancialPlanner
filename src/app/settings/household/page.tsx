import SettingsPage from "@/components/SettingsPage";
import { requireContext } from "@/lib/session";
import { updateHousehold } from "@/actions/admin";
import { CURRENCY_CODES } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Household basics: the name, the budget every month is measured against, the
 * share of savings paid as an incentive, and how money is written.
 *
 * Owner-only. A member still sees the values — knowing the budget is part of
 * using the ledger — but the fields are inert rather than hidden.
 */
export default async function HouseholdSettings() {
  const { household, role } = await requireContext();
  const owner = role === "owner";

  return (
    <SettingsPage
      title="Household"
      description="Your household's name, the monthly budget everything is measured against, and how money is displayed."
    >
      <form action={updateHousehold} className="rounded-[22px] bg-card p-6 lg:p-8">
        <div className="flex flex-col gap-5">
          <label className="block">
            <span className="eyebrow text-muted">Household name</span>
            <input
              name="name"
              defaultValue={household.name}
              disabled={!owner}
              className="field mt-2 disabled:text-muted"
            />
            <span className="mt-2 block text-[13px] text-muted">
              What this ledger is called — shown at the top of every page.
            </span>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Monthly budget</span>
            <input
              name="monthlyBudget"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              defaultValue={Number(household.monthlyBudget)}
              disabled={!owner}
              className="field num mt-2 disabled:text-muted"
            />
            <span className="mt-2 block text-[13px] text-muted">
              The target spend for one month. Whatever is left over at month end counts as savings.
            </span>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Incentive %</span>
            <input
              name="incentivePct"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              max="100"
              defaultValue={household.incentivePct}
              disabled={!owner}
              className="field num mt-2 disabled:text-muted"
            />
            <span className="mt-2 block text-[13px] text-muted">
              The share of each month&rsquo;s savings paid out as a reward for keeping under budget.
              At 10%, saving 50,000 earns 5,000.
            </span>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Currency</span>
            <select
              name="currency"
              defaultValue={household.currency}
              disabled={!owner}
              className="field mt-2 disabled:text-muted"
            >
              {CURRENCY_CODES.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <span className="mt-2 block text-[13px] text-muted">
              PKR and INR show lakh and crore; others use standard grouping.
            </span>
          </label>
        </div>

        <div className="mt-7">
          {owner ? (
            <button className="btn w-full">Save changes</button>
          ) : (
            <p className="text-[13px] font-semibold text-muted">
              Only the household owner can change these.
            </p>
          )}
        </div>
      </form>
    </SettingsPage>
  );
}
