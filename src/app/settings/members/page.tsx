import SettingsPage from "@/components/SettingsPage";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { eq } from "drizzle-orm";
import { addMember } from "@/actions/admin";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Members: the people who can sign in.
 *
 * Deliberately separate from /settings/people — a member holds an account and
 * a password, a person is only a tag on a transaction. Only the owner sees the
 * invite form; everyone else gets the list plus a line saying why.
 */
export default async function MembersSettings({
  searchParams
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const sp = await searchParams;
  const { household, role } = await requireContext();

  const members = await db()
    .select({ name: t.users.name, email: t.users.email, role: t.memberships.role })
    .from(t.memberships)
    .innerJoin(t.users, eq(t.users.id, t.memberships.userId))
    .where(eq(t.memberships.householdId, household.id));

  return (
    <SettingsPage
      title="Members"
      description="Members are the people who can sign in to this household and see its books. This is not the same as People: a person there is only a tag you put on an expense, while a member here has an email and a password of their own."
    >
      {sp.e && (
        <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">{sp.e}</p>
      )}
      <div className="overflow-hidden rounded-[22px] bg-card">
        {members.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-6">
            <p className="text-[15px] font-bold">No members yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Invite someone below to give them a sign-in of their own.
            </p>
          </div>
        ) : (
          <ul>
            {members.map((m, i) => (
              <li
                key={m.email}
                className={
                  "flex items-center gap-3 px-5 py-4 lg:px-6 " +
                  (i < members.length - 1 ? "rule-row" : "")
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{m.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">{m.email}</span>
                </span>
                <span className={m.role === "owner" ? "tag-acid shrink-0" : "tag-muted shrink-0"}>
                  {m.role === "owner" ? "owner" : "member"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {role === "owner" ? (
          <form action={addMember} className="border-t border-line bg-card p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input name="name" placeholder="Name" className="field min-w-0 flex-1" />
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="field min-w-0 flex-1"
                required
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                name="password"
                type="password"
                placeholder="Starter password (if new)"
                className="field min-w-0 flex-1"
              />
              <button className="btn shrink-0 px-4" aria-label="Add member">
                <Plus size={17} strokeWidth={2.75} />
              </button>
            </div>
            <p className="mt-3 text-[13px] text-muted">
              An existing Trusses account joins straight away. A new email needs a starter
              password of at least 8 characters, which they can use to sign in.
            </p>
          </form>
        ) : (
          <div className="border-t border-line bg-card p-5 text-[13px] text-muted lg:p-6">
            Only the household owner can invite new members or remove existing ones.
          </div>
        )}
      </div>
    </SettingsPage>
  );
}
