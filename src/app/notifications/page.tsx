import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { markAllRead, markRead, markUnread, dismiss, clearAll } from "@/actions/notifications";
import { Bell, Upload, Inbox, Wallet, Target, Building2, Check, Dot, X, CheckCheck, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const ICONS: Record<string, typeof Bell> = {
  import: Upload,
  review: Inbox,
  budget: Wallet,
  goal: Target,
  asset: Building2
};

/**
 * "2h ago" — the feed is about recency, not timestamps. Hand-rolled because a
 * date library would be a dependency bought for eight lines of arithmetic.
 */
function ago(at: Date | string) {
  const secs = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const { household, user } = await requireContext();
  const filter = sp.filter === "unread" ? "unread" : "all";

  // Mirror the bell: only what is addressed to me (or nobody), and never my
  // own action reported back at me.
  const forMe = and(
    eq(t.notifications.householdId, household.id),
    or(isNull(t.notifications.userId), eq(t.notifications.userId, user.id)),
    or(isNull(t.notifications.excludeUserId), ne(t.notifications.excludeUserId, user.id))
  );
  const where = filter === "unread" ? and(forMe, isNull(t.notifications.readAt)) : forMe;

  const notes = await db()
    .select()
    .from(t.notifications)
    .where(where)
    .orderBy(desc(t.notifications.createdAt))
    .limit(100);

  const unread = notes.filter((n) => !n.readAt).length;
  const read = notes.length - unread;

  const tabs = [
    { key: "all", label: "All" },
    { key: "unread", label: unread ? `Unread · ${unread}` : "Unread" }
  ];

  return (
    <Shell title="Notifications">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/notifications" : `/notifications?filter=${tab.key}`}
            className={
              "chip transition " +
              (filter === tab.key ? "bg-ink text-page" : "hover:bg-line")
            }
          >
            {tab.label}
          </Link>
        ))}

        <span className="flex-1" />

        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn-quiet btn-sm">
              <CheckCheck size={15} strokeWidth={2.3} />
              Mark all read
            </button>
          </form>
        )}
        {read > 0 && (
          <form action={clearAll}>
            <button className="btn-quiet btn-sm">
              <Trash2 size={15} strokeWidth={2.3} />
              Clear read
            </button>
          </form>
        )}
      </div>

      {notes.length === 0 ? (
        <EmptyState
          Icon={Bell}
          title={filter === "unread" ? "Nothing unread" : "Nothing yet"}
          body={
            filter === "unread"
              ? "You're caught up. New imports, budget alerts and goal milestones will show up here."
              : "Finished imports, budget alerts and goal milestones land here so nothing important goes unnoticed."
          }
          tone={filter === "unread" ? "acid" : "plain"}
          action={
            filter === "unread" ? (
              <Link href="/notifications" className="btn">
                See all notifications
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-[22px] bg-card">
          {notes.map((n, i) => {
            const Icon = ICONS[n.kind] ?? Bell;
            const body = (
              <span className="flex min-w-0 flex-1 gap-4">
                <span
                  className={
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full " +
                    (n.readAt ? "bg-page text-muted" : "bg-acid text-ink")
                  }
                >
                  <Icon size={19} strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-bold">{n.title}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-muted">
                      {ago(n.createdAt)}
                    </span>
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.body}</span>
                  )}
                </span>
              </span>
            );

            return (
              <li
                key={n.id}
                className={
                  "flex items-start gap-2 px-4 py-4 lg:px-6 " +
                  (i < notes.length - 1 ? "rule-row " : "") +
                  (n.readAt ? "" : "bg-acid/5")
                }
              >
                {/*
                  The link and the buttons are siblings, never nested: a <form>
                  inside an <a> is invalid HTML and browsers unnest it.
                */}
                {n.href ? (
                  <Link href={n.href} className="flex min-w-0 flex-1 gap-4 rounded-[14px] transition hover:opacity-70">
                    {body}
                  </Link>
                ) : (
                  body
                )}

                <span className="flex shrink-0 items-center gap-1 pt-1">
                  <form action={n.readAt ? markUnread : markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      aria-label={n.readAt ? "Mark as unread" : "Mark as read"}
                      title={n.readAt ? "Mark as unread" : "Mark as read"}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                    >
                      {n.readAt ? <Dot size={20} strokeWidth={3} /> : <Check size={16} strokeWidth={2.4} />}
                    </button>
                  </form>

                  <form action={dismiss}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      aria-label="Dismiss notification"
                      title="Dismiss"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                    >
                      <X size={16} strokeWidth={2.4} />
                    </button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {notes.length >= 100 && (
        <p className="mt-4 text-center text-[13px] text-muted">
          Showing the 100 most recent.
        </p>
      )}
    </Shell>
  );
}
