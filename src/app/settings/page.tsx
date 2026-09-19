import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { updateHousehold, addAccount, archiveAccount, addCategory, addPerson, addMember, deleteRule } from "@/actions/admin";
import { logout } from "@/actions/auth";
import { Plus, LogOut, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const { user, household, role } = await requireContext();
  const [accounts, categories, persons, rules, members] = await Promise.all([
    db().select().from(t.accounts).where(eq(t.accounts.householdId, household.id)).orderBy(asc(t.accounts.id)),
    db().select().from(t.categories).where(eq(t.categories.householdId, household.id)).orderBy(asc(t.categories.name)),
    db().select().from(t.persons).where(eq(t.persons.householdId, household.id)).orderBy(asc(t.persons.id)),
    db().select().from(t.importRules).where(eq(t.importRules.householdId, household.id)).orderBy(asc(t.importRules.priority)),
    db().select({ name: t.users.name, email: t.users.email, role: t.memberships.role })
      .from(t.memberships).innerJoin(t.users, eq(t.users.id, t.memberships.userId))
      .where(eq(t.memberships.householdId, household.id))
  ]);

  return (
    <Shell wide title="Settings">
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">{sp.e}</p>
      )}

      {/* Two independent columns, each packing top-down: cards have very
          different heights, so a grid would leave row gaps. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-1/2 lg:shrink-0">
        {/* ── Household ────────────────────────────────────────────────── */}
        <section className="zone-acid">
          <h2 className="eyebrow">Household</h2>
          <form action={updateHousehold} className="mt-6 space-y-4">
            <input name="name" defaultValue={household.name} className="field" />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="eyebrow text-ink/55">Monthly budget (PKR)</span>
                <input name="monthlyBudget" type="number" inputMode="numeric"
                  defaultValue={Number(household.monthlyBudget)} className="field num mt-2" />
              </label>
              <label className="block">
                <span className="eyebrow text-ink/55">Incentive %</span>
                <input name="incentivePct" type="number" defaultValue={household.incentivePct} className="field num mt-2" />
              </label>
            </div>
            {role === "owner"
              ? <button className="btn w-full">Save</button>
              : <p className="text-[13px] font-bold text-ink/55">Only the owner can change these.</p>}
          </form>
        </section>

        {/* ── Accounts ─────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] bg-card">
          <h2 className="eyebrow px-6 pb-2 pt-6 lg:px-8">Accounts</h2>
          <ul className="px-6 lg:px-8">
            {accounts.map(a => (
              <li key={a.id} className="rule-row flex items-center justify-between gap-3 py-4 text-[15px]">
                <span className={"flex min-w-0 items-center gap-2.5 font-semibold " + (a.isArchived ? "text-muted line-through" : "")}>
                  <span className="truncate">{a.name}</span>
                  <span className="tag-muted shrink-0">{a.kind}</span>
                </span>
                {!a.isArchived && a.kind !== "cash" && (
                  <form action={archiveAccount} className="shrink-0">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="tag-muted transition hover:bg-line">archive</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addAccount} className="flex items-stretch gap-2.5 p-6 lg:px-8">
            <input name="name" placeholder="e.g. Bank Al Habib" className="field w-auto flex-1 basis-0" />
            <select name="kind" className="field shrink-0 basis-[96px] px-2 [width:96px]" aria-label="Account kind">
              <option value="bank">bank</option>
              <option value="cash">cash</option>
            </select>
            <button className="btn shrink-0 px-4" aria-label="Add account">
              <Plus size={17} strokeWidth={2.75} />
            </button>
          </form>
        </section>

        {/* ── Categories ───────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] bg-card">
          <h2 className="eyebrow px-6 pt-6 lg:px-8">Categories</h2>
          <div className="flex flex-wrap gap-2 p-6 lg:px-8">
            {categories.map(c => (
              <span key={c.id} className="chip">{c.name}{c.passthroughDefault ? " ⇄" : ""}</span>
            ))}
          </div>
          <form action={addCategory} className="flex flex-wrap items-center gap-3 bg-page p-6 lg:px-8">
            <input name="name" placeholder="New category" className="field w-auto flex-1 basis-0" />
            <label className="flex items-center gap-2 text-[13px] font-bold">
              <input type="checkbox" name="passthroughDefault" className="h-4 w-4 rounded accent-ink" />
              pass-through
            </label>
            <button className="btn shrink-0 px-4" aria-label="Add category">
              <Plus size={17} strokeWidth={2.75} />
            </button>
          </form>
        </section>

        </div>

        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
        {/* ── People ───────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] bg-card">
          <h2 className="eyebrow px-6 pt-6 lg:px-8">People (for expense tagging)</h2>
          <div className="flex flex-wrap gap-2 p-6 lg:px-8">
            {persons.map(p => <span key={p.id} className="chip">{p.name}</span>)}
          </div>
          <form action={addPerson} className="flex gap-2.5 bg-page p-6 lg:px-8">
            <input name="name" placeholder="e.g. Miral" className="field w-auto flex-1 basis-0" />
            <button className="btn shrink-0 px-4" aria-label="Add person">
              <Plus size={17} strokeWidth={2.75} />
            </button>
          </form>
        </section>

        {/* ── Members ──────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] bg-card">
          <h2 className="eyebrow px-6 pb-2 pt-6 lg:px-8">Members</h2>
          <ul className="px-6 lg:px-8">
            {members.map((mb, i) => (
              <li key={i}
                className={"flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-4 text-[15px] "
                  + (role === "owner" || i < members.length - 1 ? "rule-row" : "")}>
                <span className="font-bold">{mb.name}</span>
                <span className="text-[13px] font-semibold text-muted">{mb.email} · {mb.role}</span>
              </li>
            ))}
          </ul>
          {role === "owner" && (
            <form action={addMember} className="space-y-3 bg-page p-6 lg:px-8">
              <div className="grid grid-cols-2 gap-3">
                <input name="name" placeholder="Name" className="field" />
                <input name="email" type="email" placeholder="Email" className="field" required />
              </div>
              <input name="password" type="password" placeholder="Starter password (if new)" className="field" />
              <button className="btn w-full">
                <Plus size={17} strokeWidth={2.75} />
                Add member
              </button>
            </form>
          )}
        </section>

        {/* ── Import rules ─────────────────────────────────────────────── */}
        {rules.length > 0 && (
          <section className="overflow-hidden rounded-[22px] bg-card">
            <h2 className="eyebrow px-6 pb-2 pt-6 lg:px-8">Import rules ({rules.length})</h2>
            <ul className="px-6 pb-4 lg:px-8">
              {rules.map((r, i) => (
                <li key={r.id}
                  className={"flex items-center justify-between gap-3 py-3 " + (i < rules.length - 1 ? "rule-row" : "")}>
                  <span className="truncate font-mono text-[12px] font-semibold">{r.pattern}</span>
                  <form action={deleteRule} className="shrink-0">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-page text-ink transition hover:bg-blush"
                      aria-label="Remove rule">
                      <X size={15} strokeWidth={2.75} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        </div>
      </div>

      {/* ── Sign out ───────────────────────────────────────────────────── */}
      <div className="mt-5">
        <form action={logout}>
          <button className="btn w-full">
            <LogOut size={16} strokeWidth={2.75} />
            Sign out ({user.email})
          </button>
        </form>
        <p className="eyebrow mt-6 text-center text-muted">Hearthbook v0.1</p>
      </div>
    </Shell>
  );
}
