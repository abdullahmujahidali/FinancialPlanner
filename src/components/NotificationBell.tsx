"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, Upload, Inbox, Wallet, Target, Building2, Check, X, ArrowRight } from "lucide-react";

export type Note = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

const ICONS: Record<string, typeof Bell> = {
  import: Upload,
  review: Inbox,
  budget: Wallet,
  goal: Target,
  asset: Building2
};

/** "2h ago" — short enough for a dropdown row. */
function ago(at: Date | string) {
  const secs = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Header bell with an activity dropdown.
 *
 * Marking as read posts to a server action; the panel closes optimistically so
 * the click feels instant even with the database a few hundred ms away.
 */
export default function NotificationBell({
  notes,
  markRead,
  dismiss
}: {
  notes: Note[];
  markRead: () => void;
  /**
   * Optional so the server can adopt per-row dismiss without every caller
   * having to pass it on the same deploy; the button simply doesn't render
   * until an action arrives.
   */
  dismiss?: (fd: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
      >
        <Bell size={18} strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-blush px-1 text-center text-[11px] font-bold leading-[18px] text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-[18px] bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="eyebrow text-ink">Activity</span>
              {unread > 0 && (
                <form
                  action={markRead}
                  onSubmit={() => setOpen(false)}
                >
                  <button className="flex items-center gap-1.5 text-[12px] font-bold text-muted transition hover:text-ink">
                    <Check size={14} strokeWidth={2.4} />
                    Mark all read
                  </button>
                </form>
              )}
            </div>

            {notes.length === 0 ? (
              <p className="border-t border-line px-5 py-8 text-center text-[14px] text-muted">
                Nothing yet. Imports, budget alerts and goal milestones appear here.
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto border-t border-line">
                {notes.map((n, i) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  const row = (
                    <span className="flex gap-3">
                      <span
                        className={
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                          (n.readAt ? "bg-page text-muted" : "bg-acid text-ink")
                        }
                      >
                        <Icon size={16} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] font-bold">{n.title}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-muted">
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
                        "flex items-start gap-1 px-5 py-3.5 transition hover:bg-page " +
                        (i < notes.length - 1 ? "rule-row " : "") +
                        (n.readAt ? "" : "bg-acid/5")
                      }
                    >
                      {/* Link and form stay siblings — a <form> inside an <a> is invalid HTML. */}
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="min-w-0 flex-1">{row}</div>
                      )}

                      {dismiss && (
                        <form action={dismiss} className="shrink-0 pt-1">
                          <input type="hidden" name="id" value={n.id} />
                          <button
                            aria-label={`Dismiss "${n.title}"`}
                            title="Dismiss"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                          >
                            <X size={14} strokeWidth={2.4} />
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-line px-5 py-3">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-ink transition hover:text-muted"
              >
                See all
                <ArrowRight size={14} strokeWidth={2.4} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
