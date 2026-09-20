import Link from "next/link";
import Shell from "@/components/Shell";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { eq, sql } from "drizzle-orm";
import { logout } from "@/actions/auth";
import { Home, Landmark, Tags, Users, UserCog, Wand2, ChevronRight, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Settings hub.
 *
 * A list of topics rather than a wall of forms: each row opens a focused page
 * that asks one thing. Owner-only topics are flagged so a member isn't sent to
 * a page they cannot change.
 */
export default async function SettingsHub() {
  const { user, household, role } = await requireContext();
  const owner = role === "owner";

  const [[accounts], [categories], [persons], [members], [rules]] = await Promise.all([
    db().select({ v: sql<string>`count(*)` }).from(t.accounts).where(eq(t.accounts.householdId, household.id)),
    db().select({ v: sql<string>`count(*)` }).from(t.categories).where(eq(t.categories.householdId, household.id)),
    db().select({ v: sql<string>`count(*)` }).from(t.persons).where(eq(t.persons.householdId, household.id)),
    db().select({ v: sql<string>`count(*)` }).from(t.memberships).where(eq(t.memberships.householdId, household.id)),
    db().select({ v: sql<string>`count(*)` }).from(t.importRules).where(eq(t.importRules.householdId, household.id))
  ]);

  const plural = (n: string, word: string) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

  const items = [
    {
      href: "/settings/household",
      Icon: Home,
      label: "Household",
      hint: "Name, monthly budget, currency",
      meta: household.name
    },
    {
      href: "/settings/accounts",
      Icon: Landmark,
      label: "Accounts",
      hint: "Banks and cash wallets money moves through",
      meta: plural(accounts.v, "account")
    },
    {
      href: "/settings/categories",
      Icon: Tags,
      label: "Categories",
      hint: "Buckets you sort spending into",
      meta: `${categories.v} categories`
    },
    {
      href: "/settings/people",
      Icon: Users,
      label: "People",
      hint: "Tag an expense to a family member",
      meta: `${persons.v} people`
    },
    {
      href: "/settings/members",
      Icon: UserCog,
      label: "Members",
      hint: "Who can sign in to this household",
      meta: plural(members.v, "member"),
      ownerOnly: true
    },
    {
      href: "/settings/rules",
      Icon: Wand2,
      label: "Import rules",
      hint: "Auto-categorise imported bank rows",
      meta: plural(rules.v, "rule")
    }
  ];

  return (
    <Shell
      back={{ href: "/", label: "Home" }} title="Settings">
      <div className="overflow-hidden rounded-[22px] bg-card">
        {items.map(({ href, Icon, label, hint, meta, ownerOnly }, i) => (
          <Link
            key={href}
            href={href}
            className={
              "flex items-center gap-4 px-5 py-4 transition hover:bg-page lg:px-6 " +
              (i < items.length - 1 ? "rule-row" : "")
            }
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-page text-ink">
              <Icon size={19} strokeWidth={2.1} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[16px] font-bold">{label}</span>
                {ownerOnly && !owner && (
                  <span className="rounded-full bg-page px-2 py-0.5 text-[11px] font-bold text-muted">
                    view only
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">{hint}</span>
            </span>

            <span className="hidden shrink-0 text-[13px] font-semibold text-muted sm:block">{meta}</span>
            <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-muted" />
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-[22px] bg-card px-5 py-5 lg:px-6">
        <p className="text-[13px] font-semibold text-muted">Signed in as</p>
        <p className="mt-0.5 truncate text-[15px] font-bold">{user.email}</p>
        <form action={logout} className="mt-4">
          <button className="btn-quiet w-full">
            <LogOut size={17} strokeWidth={2.2} />
            Sign out
          </button>
        </form>
      </div>

      <p className="eyebrow mt-6 text-center text-muted">Trusses v0.1</p>
    </Shell>
  );
}
