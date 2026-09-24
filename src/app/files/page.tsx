import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import ConfirmDelete from "@/components/ConfirmDelete";
import { requireContext } from "@/lib/session";
import { db, t } from "@/db/client";
import { desc, eq } from "drizzle-orm";
import { deleteAttachment } from "@/actions/files";
import {
  File as FileIcon, FileText, Image as ImageIcon, FolderOpen, Upload,
  ExternalLink, ArrowUpRight
} from "lucide-react";

export const dynamic = "force-dynamic";

type Params = { tab?: string };

/** Roughly 20 MB — past this, base64-in-Postgres stops being a reasonable home. */
const STORAGE_WARN = 20 * 1024 * 1024;

/** Human-readable byte size. */
function bytes(n: number) {
  if (!n || n < 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function fmtDate(at: Date | string) {
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

/** Ledger months are keyed YYYY-MM; derive one from a batch's timestamp. */
function monthKey(at: Date | string) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function iconFor(mime: string) {
  if (mime === "application/pdf") return FileText;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileIcon;
}

/**
 * Files & imports.
 *
 * Both halves of this page record things the app already stores but never
 * showed: attachments vanish the moment they are uploaded, and an import batch
 * is only visible on the redirect straight after importing. Two tabs rather
 * than two pages, because they answer the same question — "what did I put in
 * here, and is it still there?".
 */
export default async function FilesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const tab = sp.tab === "imports" ? "imports" : "files";

  const { household } = await requireContext();

  // Left-joined to both possible parents: an attachment hangs off a
  // transaction OR an asset, and we want whichever one names it.
  const files = tab === "files"
    ? await db()
        .select({
          id: t.attachments.id,
          filename: t.attachments.filename,
          mime: t.attachments.mime,
          size: t.attachments.size,
          transactionId: t.attachments.transactionId,
          assetId: t.attachments.assetId,
          txDescription: t.transactions.description,
          txDate: t.transactions.txDate,
          assetName: t.assets.name
        })
        .from(t.attachments)
        .leftJoin(t.transactions, eq(t.transactions.id, t.attachments.transactionId))
        .leftJoin(t.assets, eq(t.assets.id, t.attachments.assetId))
        .where(eq(t.attachments.householdId, household.id))
        .orderBy(desc(t.attachments.id))
    : [];

  const batches = tab === "imports"
    ? await db()
        .select({
          id: t.importBatches.id,
          filename: t.importBatches.filename,
          rowCount: t.importBatches.rowCount,
          importedCount: t.importBatches.importedCount,
          duplicateCount: t.importBatches.duplicateCount,
          ignoredCount: t.importBatches.ignoredCount,
          balanceOk: t.importBatches.balanceOk,
          createdAt: t.importBatches.createdAt,
          accountName: t.accounts.name
        })
        .from(t.importBatches)
        .leftJoin(t.accounts, eq(t.accounts.id, t.importBatches.accountId))
        .where(eq(t.importBatches.householdId, household.id))
        .orderBy(desc(t.importBatches.createdAt))
    : [];

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  const chip = (key: "files" | "imports", label: string) => (
    <Link
      href={`/files?tab=${key}`}
      aria-current={tab === key ? "page" : undefined}
      className={
        "rounded-full px-4 py-2 text-[13px] font-bold transition " +
        (tab === key ? "bg-ink text-white" : "bg-card text-ink hover:bg-page")
      }
    >
      {label}
    </Link>
  );

  return (
    <Shell
      back={{ href: "/settings", label: "Settings" }} wide title="Files & imports">
      <div className="mb-5 flex gap-2">
        {chip("files", "Files")}
        {chip("imports", "Imports")}
      </div>

      {tab === "files" ? (
        files.length === 0 ? (
          <EmptyState
            Icon={FolderOpen}
            title="No files yet"
            body="Receipts and asset photos attached to an entry show up here, so you can find a bill months later without hunting through the ledger."
            action={<Link href="/entry" className="btn">Add an entry</Link>}
          />
        ) : (
          <>
            <section className="mb-4 rounded-[22px] bg-card px-5 py-4 lg:px-6">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-[15px] font-bold">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </p>
                <p className="text-[14px] font-semibold text-muted">
                  <span className="num">{bytes(totalBytes)}</span> stored
                </p>
              </div>
              {totalBytes > STORAGE_WARN && (
                <p className="mt-2 text-[13px] font-medium text-muted">
                  Attachments are kept as base64 inside Postgres, which stops being
                  sensible at this size — these should move to object storage.
                </p>
              )}
            </section>

            <div className="overflow-hidden rounded-[22px] bg-card">
              {files.map((f, i) => {
                const Icon = iconFor(f.mime);
                const parentHref = f.assetId
                  ? `/assets/${f.assetId}`
                  : f.txDate
                    ? `/ledger?m=${monthKey(f.txDate)}`
                    : null;
                const parentLabel = f.assetName
                  ?? (f.txDescription || (f.transactionId ? "Transaction" : null));

                return (
                  <div
                    key={f.id}
                    className={
                      "flex items-center gap-4 px-5 py-4 lg:px-6 " +
                      (i < files.length - 1 ? "rule-row" : "")
                    }
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-page text-ink">
                      <Icon size={19} strokeWidth={2.1} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">{f.filename}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        <span className="num">{bytes(f.size)}</span>
                        <span className="mx-1.5">·</span>
                        {f.mime}
                      </p>
                      {parentLabel && (
                        <p className="mt-1 truncate text-[13px] text-muted">
                          {parentHref ? (
                            <Link
                              href={parentHref}
                              className="inline-flex items-center gap-1 font-semibold text-ink hover:underline"
                            >
                              {parentLabel}
                              <ArrowUpRight size={13} strokeWidth={2.4} />
                            </Link>
                          ) : (
                            <span className="font-semibold text-ink">{parentLabel}</span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={`/api/attachment/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-quiet btn-sm"
                      >
                        <ExternalLink size={14} strokeWidth={2.2} />
                        <span className="hidden sm:inline">View</span>
                      </a>
                      <ConfirmDelete id={f.id} label={f.filename} action={deleteAttachment} noun="file" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : batches.length === 0 ? (
        <EmptyState
          Icon={Upload}
          title="No imports yet"
          body="Every bank CSV you import is logged here with its row counts and balance tie-out, so you can tell what landed and when."
          action={<Link href="/import" className="btn">Import a CSV</Link>}
        />
      ) : (
        <div className="overflow-hidden rounded-[22px] bg-card">
          {batches.map((b, i) => (
            <div
              key={b.id}
              className={
                "px-5 py-4 lg:px-6 " + (i < batches.length - 1 ? "rule-row" : "")
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{b.filename}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {b.accountName ?? "Unknown account"}
                    <span className="mx-1.5">·</span>
                    {fmtDate(b.createdAt)}
                  </p>
                </div>

                <span className="shrink-0">
                  {b.balanceOk === true ? (
                    <span className="tag-acid">tie-out passed</span>
                  ) : b.balanceOk === false ? (
                    <span className="tag-blush">tie-out failed</span>
                  ) : (
                    <span className="tag-muted">not checked</span>
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip num">{b.importedCount} imported</span>
                <span className="chip num">{b.duplicateCount} duplicate{b.duplicateCount === 1 ? "" : "s"}</span>
                <span className="chip num">{b.ignoredCount} ignored</span>
                <Link
                  href={`/ledger?m=${monthKey(b.createdAt)}`}
                  className="inline-flex items-center gap-1 px-1 text-[13px] font-bold text-ink hover:underline"
                >
                  See what landed
                  <ArrowUpRight size={14} strokeWidth={2.4} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
