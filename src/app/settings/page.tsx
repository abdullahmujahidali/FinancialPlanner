import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { asc, eq } from "drizzle-orm";
import { updateHousehold, addAccount, archiveAccount, addCategory, addPerson, addMember, deleteRule } from "@/actions/admin";
import { logout } from "@/actions/auth";

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
    <Shell title="Settings">
      {searchParams.e && <p className="mb-4 rounded-xl bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}

      <section className="mb-5 panel p-4">
        <h2 className="mb-3 text-sm font-medium">Household</h2>
        <form action={updateHousehold} className="space-y-3">
          <input name="name" defaultValue={household.name} className="field" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">Monthly budget (PKR)
              <input name="monthlyBudget" type="number" inputMode="numeric" defaultValue={Number(household.monthlyBudget)} className="field num mt-1" />
            </label>
            <label className="text-sm text-muted">Incentive %
              <input name="incentivePct" type="number" defaultValue={household.incentivePct} className="field num mt-1" />
            </label>
          </div>
          {role === "owner" ? <button className="btn-quiet w-full">Save</button> : <p className="text-xs text-muted">Only the owner can change these.</p>}
        </form>
      </section>

      <section className="mb-5 panel p-4">
        <h2 className="mb-3 text-sm font-medium">Accounts</h2>
        <div className="mb-3 space-y-1.5 text-sm">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between">
              <span className={a.isArchived ? "text-muted line-through" : ""}>{a.name} <span className="text-xs text-muted">({a.kind})</span></span>
              {!a.isArchived && a.kind !== "cash" && (
                <form action={archiveAccount}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted underline">archive</button></form>
              )}
            </div>
          ))}
        </div>
        <form action={addAccount} className="flex gap-2">
          <input name="name" placeholder="e.g. Bank Al Habib" className="field min-w-0" />
          <select name="kind" className="field w-28"><option value="bank">bank</option><option value="cash">cash</option></select>
          <button className="btn-quiet shrink-0">Add</button>
        </form>
      </section>

      <section className="mb-5 panel p-4">
        <h2 className="mb-3 text-sm font-medium">Categories</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map(c => <span key={c.id} className="chip">{c.name}{c.passthroughDefault ? " ⇄" : ""}</span>)}
        </div>
        <form action={addCategory} className="flex flex-wrap items-center gap-2">
          <input name="name" placeholder="New category" className="field min-w-0 flex-1" />
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="passthroughDefault" className="h-4 w-4 accent-[#0E6E4C]" /> pass-through</label>
          <button className="btn-quiet shrink-0">Add</button>
        </form>
      </section>

      <section className="mb-5 panel p-4">
        <h2 className="mb-3 text-sm font-medium">People (for expense tagging)</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {persons.map(p => <span key={p.id} className="chip">{p.name}</span>)}
        </div>
        <form action={addPerson} className="flex gap-2">
          <input name="name" placeholder="e.g. Miral" className="field min-w-0" />
          <button className="btn-quiet shrink-0">Add</button>
        </form>
      </section>

      <section className="mb-5 panel p-4">
        <h2 className="mb-3 text-sm font-medium">Members</h2>
        <div className="mb-3 space-y-1 text-sm">
          {members.map((mb, i) => <div key={i}>{mb.name} <span className="text-xs text-muted">· {mb.email} · {mb.role}</span></div>)}
        </div>
        {role === "owner" && (
          <form action={addMember} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input name="name" placeholder="Name" className="field" />
              <input name="email" type="email" placeholder="Email" className="field" required />
            </div>
            <input name="password" type="password" placeholder="Starter password (if new)" className="field" />
            <button className="btn-quiet w-full">Add member</button>
          </form>
        )}
      </section>

      {rules.length > 0 && (
        <section className="mb-5 panel p-4">
          <h2 className="mb-3 text-sm font-medium">Import rules ({rules.length})</h2>
          <div className="space-y-1.5 text-sm">
            {rules.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs">{r.pattern}</span>
                <form action={deleteRule}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted underline">remove</button></form>
              </div>
            ))}
          </div>
        </section>
      )}

      <form action={logout}>
        <button className="btn-quiet w-full">Sign out ({user.email})</button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">Hearthbook v0.1</p>
    </Shell>
  );
}
