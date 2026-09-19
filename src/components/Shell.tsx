import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";

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
  const { household } = await requireContext();
  const [review] = await db()
    .select({ v: sql<string>`count(*)` })
    .from(t.transactions)
    .where(and(eq(t.transactions.householdId, household.id), eq(t.transactions.needsReview, true)));

  return (
    <div className="lg:pl-[248px]">
      <Sidebar household={household.name} reviewCount={Number(review.v)} />
      <div
        className={
          "mx-auto min-h-screen px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-10 lg:pb-12 lg:pt-8 " +
          (wide ? "max-w-lg lg:max-w-[1180px]" : "max-w-lg lg:max-w-3xl")
        }
      >
        <header className="mb-5 flex items-center justify-between gap-3 lg:mb-7">
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-tight lg:text-[32px]">
            {title}
          </h1>
          {action}
        </header>
        {children}
        <Nav />
      </div>
    </div>
  );
}
