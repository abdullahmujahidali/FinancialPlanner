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
              className="field mt-2"
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
              className="field num mt-2"
            />
            <span className="mt-2 block text-[13px] text-muted">
              The target spend for one month. Whatever is left over at month end counts as savings.
            </span>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Incentive %</span>
            {owner ? (
              <input
                name="incentivePct"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                max="100"
                defaultValue={household.incentivePct}
                className="field num mt-2"
              />
            ) : (
              <span className="money mt-2 block text-[28px] font-bold">
                {household.incentivePct}%
              </span>
            )}
            <span className="mt-2 block text-[13px] text-muted">
              The share of each month&rsquo;s savings paid out as a reward for keeping under budget.
              At {household.incentivePct}%, saving 50,000 earns{" "}
              {(50000 * household.incentivePct) / 100 % 1 === 0
                ? ((50000 * household.incentivePct) / 100).toLocaleString("en-PK")
                : ((50000 * household.incentivePct) / 100).toFixed(2)}
              .
              {!owner && " The owner sets this rate."}
            </span>
          </label>

          <label className="block">
            <span className="eyebrow text-muted">Currency</span>
            <select
              name="currency"
              defaultValue={household.currency}
              className="field mt-2"
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
          <button className="btn w-full">Save changes</button>
        </div>
      </form>
    </SettingsPage>
  );
}
