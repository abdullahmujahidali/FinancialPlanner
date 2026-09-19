import { MessageCircle, X } from "lucide-react";
import CommentComposer from "./CommentComposer";

/** The five reactions on offer. Five is a glance; a picker is a decision. */
const EMOJI = ["👍", "✅", "❓", "😮", "❤️"] as const;

export type ThreadComment = {
  id: number;
  body: string;
  createdAt: Date | string;
  userId: number;
  authorName: string;
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
};

/**
 * Fold flat comment + reaction rows into per-entity threads.
 *
 * Lives here rather than in src/actions/comments.ts because a "use server" file
 * may only export async functions — a plain helper there is a build error. The
 * pages batch the two queries into their existing Promise.all and hand the rows
 * straight to this.
 */
export function groupThreads(
  rows: Array<{
    id: number;
    body: string;
    createdAt: Date | string;
    userId: number;
    entityId: number | null;
    authorName: string;
  }>,
  reactions: Array<{ commentId: number; userId: number; emoji: string }>,
  currentUserId: number
) {
  const byComment = new Map<number, Map<string, { count: number; mine: boolean }>>();
  for (const r of reactions) {
    let m = byComment.get(r.commentId);
    if (!m) {
      m = new Map();
      byComment.set(r.commentId, m);
    }
    const cur = m.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.userId === currentUserId) cur.mine = true;
    m.set(r.emoji, cur);
  }

  const out = new Map<number, ThreadComment[]>();
  const ordered = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id
  );
  for (const row of ordered) {
    if (row.entityId == null) continue;
    const list = out.get(row.entityId) ?? [];
    list.push({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      userId: row.userId,
      authorName: row.authorName,
      reactions: [...(byComment.get(row.id) ?? new Map())].map(([emoji, v]) => ({
        emoji,
        count: v.count,
        mine: v.mine
      }))
    });
    out.set(row.entityId, list);
  }
  return out;
}

/**
 * "2h ago". Hand-rolled: a date library is a lot of kilobytes for six branches,
 * and the ledger renders this once per comment.
 */
function ago(at: Date | string) {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Split a body into plain text and @mentions so mentions can be styled without
 * dangerouslySetInnerHTML — React escapes each segment for us.
 */
function segments(body: string) {
  const out: Array<{ text: string; mention: boolean }> = [];
  const re = /@[\p{L}][\p{L}\p{N}_'-]*/gu;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: body.slice(last, i), mention: false });
    out.push({ text: m[0], mention: true });
    last = i + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}

function Body({ body }: { body: string }) {
  return (
    <>
      {segments(body).map((s, i) =>
        s.mention ? (
          <span key={i} className="font-bold text-ink">{s.text}</span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

/**
 * The conversation hanging off one transaction, asset or goal.
 *
 * A server component on purpose — it renders whatever the page already fetched,
 * so 56 ledger rows still cost the page exactly two extra queries, not 56.
 */
export default function CommentThread({
  entityType,
  entityId,
  comments,
  currentUserId,
  members,
  addAction,
  deleteAction,
  reactAction
}: {
  entityType: "transaction" | "asset" | "goal";
  entityId: number;
  comments: ThreadComment[];
  currentUserId: number;
  /** Household members, for @mention autocomplete in the composer. */
  members: Array<{ id: number; name: string }>;
  addAction: (fd: FormData) => void;
  deleteAction: (fd: FormData) => void;
  reactAction: (fd: FormData) => void;
}) {
  const reply = (
    <CommentComposer
      entityType={entityType}
      entityId={entityId}
      members={members}
      action={addAction}
    />
  );

  // Nothing said yet — stay out of the way. The ledger is a list of money, not
  // a list of empty comment boxes.
  if (comments.length === 0) {
    return (
      <details className="mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12px] font-bold text-muted transition hover:text-ink">
          <MessageCircle size={14} strokeWidth={2.2} />
          Add a note
        </summary>
        <div className="mt-2.5">{reply}</div>
      </details>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] bg-page">
      {comments.map((c) => (
        <div key={c.id} className="group border-b border-line px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-[13px] leading-snug">
              <span className="font-bold">{c.authorName}</span>{" "}
              <span className="text-body"><Body body={c.body} /></span>{" "}
              <span className="whitespace-nowrap text-[11px] font-semibold text-muted">
                {ago(c.createdAt)}
              </span>
            </p>

            {/* Its own form — siblings only, never nested inside the reply form. */}
            {c.userId === currentUserId && (
              <form action={deleteAction} className="shrink-0">
                <input type="hidden" name="id" value={c.id} />
                <button
                  aria-label="Delete comment"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-card hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={13} strokeWidth={2.6} />
                </button>
              </form>
            )}
          </div>

          {/* Reactions sit on the same baseline as the text: a hidden row that
              still reserved height was leaving an odd gap under every comment. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {EMOJI.map((e) => {
              const r = c.reactions.find((x) => x.emoji === e);
              const count = r?.count ?? 0;
              const mine = r?.mine ?? false;
              return (
                <form
                  key={e}
                  action={reactAction}
                  // Anything with a count is always visible; the rest appear on
                  // hover or keyboard focus so five buttons don't shout.
                  className={
                    count > 0
                      ? "contents"
                      : "hidden focus-within:contents group-hover:contents"
                  }
                >
                  <input type="hidden" name="commentId" value={c.id} />
                  <input type="hidden" name="emoji" value={e} />
                  <button
                    aria-label={`React ${e}`}
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-none transition " +
                      (mine
                        ? "bg-acid text-ink"
                        : "bg-card text-muted hover:bg-line hover:text-ink")
                    }
                  >
                    <span className="text-[13px] leading-none">{e}</span>
                    {count > 0 && <span className="num">{count}</span>}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      ))}

      <div className="px-4 py-3">{reply}</div>
    </div>
  );
}
