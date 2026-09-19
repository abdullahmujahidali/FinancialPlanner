import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { updateHousehold, addAccount, archiveAccount, addCategory, addPerson, addMember, deleteRule } from "@/actions/admin";
import { logout } from "@/actions/auth";
import { Plus, LogOut, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: { e?: string } }) {
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
      {searchParams.e && (
        <p className="mb-4 border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">{searchParams.e}</p>
      )}

      {/* Two independent columns, each packing top-down: cards have very
          different heights, so a grid would leave row gaps. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-4 lg:w-1/2 lg:shrink-0">
        {/* ── Household ────────────────────────────────────────────────── */}
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line bg-acid px-5 py-3">Household</h2>
          <form action={updateHousehold} className="space-y-3 p-4 lg:p-5">
            <input name="name" defaultValue={household.name} className="field" />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="eyebrow text-muted">Monthly budget (PKR)</span>
                <input name="monthlyBudget" type="number" inputMode="numeric"
                  defaultValue={Number(household.monthlyBudget)} className="field num mt-1.5" />
              </label>
              <label className="block">
                <span className="eyebrow text-muted">Incentive %</span>
                <input name="incentivePct" type="number" defaultValue={household.incentivePct} className="field num mt-1.5" />
              </label>
            </div>
            {role === "owner"
              ? <button className="btn w-full">Save</button>
              : <p className="text-[12px] font-bold text-muted">Only the owner can change these.</p>}
          </form>
        </section>

        {/* ── Accounts ─────────────────────────────────────────────────── */}
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line px-5 py-3">Accounts</h2>
          <ul>
            {accounts.map(a => (
              <li key={a.id} className="rule-row flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className={"min-w-0 truncate font-medium " + (a.isArchived ? "text-muted line-through" : "")}>
                  {a.name} <span className="eyebrow text-muted">{a.kind}</span>
                </span>
                {!a.isArchived && a.kind !== "cash" && (
                  <form action={archiveAccount} className="shrink-0">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="tag bg-card transition-all hover:shadow-hardsm">archive</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addAccount} className="flex items-stretch gap-2 p-4 lg:p-5">
            <input name="name" placeholder="e.g. Bank Al Habib" className="field w-auto flex-1 basis-0" />
            <select name="kind" className="field shrink-0 basis-[96px] px-2 [width:96px]" aria-label="Account kind">
              <option value="bank">bank</option>
              <option value="cash">cash</option>
            </select>
            <button className="btn btn-sm shrink-0 px-3" aria-label="Add account">
              <Plus size={16} strokeWidth={3} />
            </button>
          </form>
        </section>

        {/* ── Categories ───────────────────────────────────────────────── */}
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line px-5 py-3">Categories</h2>
          <div className="flex flex-wrap gap-2 border-b-2 border-line p-4 lg:p-5">
            {categories.map(c => (
              <span key={c.id} className="chip">{c.name}{c.passthroughDefault ? " ⇄" : ""}</span>
            ))}
          </div>
          <form action={addCategory} className="flex flex-wrap items-center gap-2 p-4 lg:p-5">
            <input name="name" placeholder="New category" className="field w-auto flex-1 basis-0" />
            <label className="flex items-center gap-2 text-[12px] font-bold">
              <input type="checkbox" name="passthroughDefault" className="h-4 w-4 accent-ink" />
              pass-through
            </label>
            <button className="btn btn-sm shrink-0" aria-label="Add category">
              <Plus size={16} strokeWidth={3} />
            </button>
          </form>
        </section>

        </div>

        <div className="flex flex-col gap-4 lg:min-w-0 lg:flex-1">
        {/* ── People ───────────────────────────────────────────────────── */}
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line px-5 py-3">People (for expense tagging)</h2>
          <div className="flex flex-wrap gap-2 border-b-2 border-line p-4 lg:p-5">
            {persons.map(p => <span key={p.id} className="chip">{p.name}</span>)}
          </div>
          <form action={addPerson} className="flex gap-2 p-4 lg:p-5">
            <input name="name" placeholder="e.g. Miral" className="field w-auto flex-1 basis-0" />
            <button className="btn btn-sm shrink-0" aria-label="Add person">
              <Plus size={16} strokeWidth={3} />
            </button>
          </form>
        </section>

        {/* ── Members ──────────────────────────────────────────────────── */}
        <section className="block-card">
          <h2 className="eyebrow border-b-2 border-line px-5 py-3">Members</h2>
          <ul>
            {members.map((mb, i) => (
              <li key={i}
                className={"flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 py-3 text-[15px] "
                  + (role === "owner" || i < members.length - 1 ? "rule-row" : "")}>
                <span className="font-bold">{mb.name}</span>
                <span className="text-[12px] font-semibold text-muted">{mb.email} · {mb.role}</span>
              </li>
            ))}
          </ul>
          {role === "owner" && (
            <form action={addMember} className="space-y-2 p-4 lg:p-5">
              <div className="grid grid-cols-2 gap-2">
                <input name="name" placeholder="Name" className="field" />
                <input name="email" type="email" placeholder="Email" className="field" required />
              </div>
              <input name="password" type="password" placeholder="Starter password (if new)" className="field" />
              <button className="btn w-full">
                <Plus size={16} strokeWidth={3} />
                Add member
              </button>
            </form>
          )}
        </section>

        {/* ── Import rules ─────────────────────────────────────────────── */}
        {rules.length > 0 && (
          <section className="block-card">
            <h2 className="eyebrow border-b-2 border-line px-5 py-3">Import rules ({rules.length})</h2>
            <ul>
              {rules.map((r, i) => (
                <li key={r.id}
                  className={"flex items-center justify-between gap-3 px-5 py-2.5 " + (i < rules.length - 1 ? "rule-row" : "")}>
                  <span className="truncate font-mono text-[12px] font-semibold">{r.pattern}</span>
                  <form action={deleteRule} className="shrink-0">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="flex h-7 w-7 items-center justify-center border-2 border-line bg-card transition-all hover:shadow-hardsm"
                      aria-label="Remove rule">
                      <X size={14} strokeWidth={3} />
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
      <div className="mt-4">
        <form action={logout}>
          <button className="btn-dark w-full">
            <LogOut size={16} strokeWidth={2.75} />
            Sign out ({user.email})
          </button>
        </form>
        <p className="eyebrow mt-4 text-center text-muted">Hearthbook v0.1</p>
      </div>
    </Shell>
  );
}
