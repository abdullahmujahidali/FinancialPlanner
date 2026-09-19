import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, sql } from "drizzle-orm";
import { logout } from "@/actions/auth";
import { markAllRead } from "@/actions/notifications";
import NotificationBell from "./NotificationBell";

/**
 * App frame. Phones get a bottom tab bar; lg+ gets a fixed sidebar rail and a
 * wider content column, so the desktop view isn't a stretched phone.
 *
 * `wide` opts a page into the full multi-column width (the dashboard); other
 * pages stay in a readable single column.
 */
export default async function Shell({
  title,
  titleSlot,
  action,
  wide = false,
  children
}: {
  title: string;
  /** Replaces the default <h1>, for pages that need a back button beside it. */
  titleSlot?: React.ReactNode;
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { household, user } = await requireContext();
  const [[review], notes] = await Promise.all([
    db()
      .select({ v: sql<string>`count(*)` })
      .from(t.transactions)
      .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true))),
    db()
      .select()
      .from(t.notifications)
      .where(eq(t.notifications.householdId, household.id))
      .orderBy(desc(t.notifications.createdAt))
      .limit(12)
  ]);

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
          {titleSlot ?? (
            <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
              {title}
            </h1>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <NotificationBell notes={notes} markRead={markAllRead} />
          </div>
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
