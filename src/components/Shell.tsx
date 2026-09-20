import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { logout } from "@/actions/auth";
import { markAllRead, dismiss } from "@/actions/notifications";
import NotificationBell from "./NotificationBell";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * App frame. Phones get a bottom tab bar; lg+ gets a fixed sidebar rail and a
 * wider content column, so the desktop view isn't a stretched phone.
 *
 * `wide` opts a page into the full multi-column width (the dashboard); other
 * pages stay in a readable single column.
 *
 * `back` is required on any page the bottom tab bar cannot reach. Without it
 * a non-technical user who opens, say, Settings › Categories has no way out
 * but the browser's own back button, which a home-screen PWA does not show.
 */
export default async function Shell({
  title,
  titleSlot,
  action,
  back,
  wide = false,
  children
}: {
  title: string;
  /** Replaces the default <h1>, for pages that need a back button beside it. */
  titleSlot?: React.ReactNode;
  action?: React.ReactNode;
  /** Where "back" goes, and what to call the place it returns to. */
  back?: { href: string; label: string };
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
      .where(and(
        eq(t.notifications.householdId, household.id),
        // not addressed to someone else, and not caused by me
        or(isNull(t.notifications.userId), eq(t.notifications.userId, user.id)),
        or(isNull(t.notifications.excludeUserId), ne(t.notifications.excludeUserId, user.id))
      ))
      .orderBy(desc(t.notifications.createdAt))
      .limit(12)
  ]);

  return (
    <div className="lg:pl-[256px]">
      <Sidebar
        household={household.name}
        userName={user.name}
        email={user.email}
        logout={logout}
        reviewCount={Number(review.v)}
      />
      <div
        className={
          "mx-auto min-h-[100dvh] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-12 lg:pb-16 lg:pt-10 " +
          (wide ? "max-w-lg lg:max-w-none xl:max-w-[1500px]" : "max-w-lg lg:max-w-3xl")
        }
      >
        <header className="mb-6 gap-3 lg:mb-8 lg:flex lg:items-center">
          <div className="flex items-center justify-between gap-3 lg:min-w-0 lg:flex-1">
            {titleSlot ?? (
              <div className="flex min-w-0 items-center gap-3">
                {back && (
                  <Link
                    href={back.href}
                    aria-label={`Back to ${back.label}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
                  >
                    <ChevronLeft size={19} strokeWidth={2.4} />
                  </Link>
                )}
                <div className="min-w-0">
                  {/* Naming the destination beats a bare chevron for anyone
                      who does not already know the app's shape. */}
                  {back && (
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                      {back.label}
                    </span>
                  )}
                  <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
                    {title}
                  </h1>
                </div>
              </div>
            )}
            {/* The bell stays beside the title on a phone; the page's own
                controls drop to their own line below. */}
            <div className="shrink-0 lg:hidden">
              <NotificationBell notes={notes} markRead={markAllRead} dismiss={dismiss} />
            </div>
          </div>
          {action && (
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:flex-nowrap lg:shrink-0">
              {action}
            </div>
          )}
          <div className="hidden shrink-0 lg:block">
            <NotificationBell notes={notes} markRead={markAllRead} dismiss={dismiss} />
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
