import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";
import { logout } from "@/actions/auth";

/**
 * App frame. Phones get a bottom tab bar; lg+ gets a fixed sidebar rail and a
 * wider content column, so the desktop view isn't a stretched phone.
 *
 * `wide` opts a page into the full multi-column width (the dashboard); other
 * pages stay in a readable single column.
 */
export default async function Shell({
  title,
  action,
  wide = false,
  children
}: {
  title: string;
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { household, user } = await requireContext();
  const [review] = await db()
    .select({ v: sql<string>`count(*)` })
    .from(t.transactions)
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true)));

  return (
    <div className="lg:pl-[256px]">
      <Sidebar household={household.name} reviewCount={Number(review.v)} />
      <div
        className={
          "mx-auto min-h-screen px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-12 lg:pb-16 lg:pt-10 " +
          (wide ? "max-w-lg lg:max-w-none xl:max-w-[1500px]" : "max-w-lg lg:max-w-3xl")
        }
      >
        <header className="mb-6 flex items-center justify-between gap-3 lg:mb-8">
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
            {title}
          </h1>
          {action}
        </header>
        {children}
        <Nav
          household={household.name}
          email={user.email}
          reviewCount={Number(review.v)}
          logout={logout}
        />
      </div>
    </div>
  );
}
