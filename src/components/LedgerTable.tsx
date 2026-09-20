import Link from "next/link";
import { Pencil, ArrowDown, ArrowUp } from "lucide-react";
import ConfirmDelete from "@/components/ConfirmDelete";
import { deleteTransaction } from "@/actions/ledger";
import { pkr } from "@/lib/money";

/**
 * The dense ledger view.
 *
 * Same rows as the card list, about three times as many per screen. This is
 * the reconciliation view: you are scanning a whole month for something that
 * looks wrong, not reading each entry. Descriptions truncate to one line here
 * on purpose — the trade the density buys.
 *
 * On phones the columns that do not fit fold into the description cell and the
 * table keeps a 520px floor, so it scrolls sideways rather than crushing every
 * column into unreadable slivers.
 */

export type LedgerRow = {
  tx: {
    id: number;
    txDate: string;
    description: string;
    amount: string;
    type: string;
    isPassthrough: boolean;
    isAbnormal: boolean;
    needsReview: boolean;
  };
  category: string | null;
  person: string | null;
  account: string | null;
};

export type SortKey = "date" | "description" | "amount";

export default function LedgerTable({
  rows,
  showYear = false,
  sort,
  dir,
  query
}: {
  rows: LedgerRow[];
  /** Searches span months, so the date column needs the year. */
  showYear?: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
  /** Current search params, so a sort link keeps the filters intact. */
  query: Record<string, string | undefined>;
}) {
  /**
   * Sort links are plain hrefs — the sorting happens in SQL, so this needs no
   * client JS and the resulting URL is shareable. Clicking the active column
   * flips direction; a new column starts descending, which is what you want
   * for amounts.
   */
  const sortHref = (key: SortKey) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "sort" && k !== "dir" && k !== "saved") q.set(k, v);
    }
    q.set("view", "table");
    q.set("sort", key);
    q.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/ledger?${q}`;
  };
  const label = (r: LedgerRow) =>
    r.tx.description ||
    r.category ||
    (r.tx.type === "transfer" ? "Transfer" : r.tx.type === "income" ? "Income" : "Expense");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <SortTh className="w-[92px]" href={sortHref("date")} active={sort === "date"} dir={dir}>
              Date
            </SortTh>
            <SortTh
              className="w-[38%] min-w-[200px]"
              href={sortHref("description")}
              active={sort === "description"}
              dir={dir}
            >
              Description
            </SortTh>
            <Th className="hidden w-[16%] min-w-[120px] md:table-cell">Category</Th>
            <Th className="hidden w-[14%] min-w-[110px] lg:table-cell">Account</Th>
            <Th className="hidden w-[11%] min-w-[90px] xl:table-cell">Person</Th>
            <SortTh
              className="w-[132px]"
              align="right"
              href={sortHref("amount")}
              active={sort === "amount"}
              dir={dir}
            >
              Amount
            </SortTh>
            <Th className="w-[72px]">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const { tx } = r;
            const name = label(r);
            return (
              <tr key={tx.id} className="border-b border-line last:border-0 hover:bg-page/60">
                <Td className="num whitespace-nowrap text-[12.5px] text-muted">
                  {new Date(tx.txDate).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    ...(showYear ? { year: "2-digit" } : {})
                  })}
                </Td>

                <Td>
                  <Link
                    href={`/ledger/${tx.id}`}
                    className="block truncate text-[14px] font-semibold hover:underline"
                    title={name}
                  >
                    {name}
                  </Link>
                  {/* Flags stay visible here — they change what a number means. */}
                  {(tx.isPassthrough || tx.isAbnormal || tx.needsReview || tx.type === "transfer") && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {tx.isPassthrough && <span className="tag-acid">pass-through</span>}
                      {tx.isAbnormal && <span className="tag-blush">one-off</span>}
                      {tx.needsReview && <span className="tag-blush">review</span>}
                      {tx.type === "transfer" && <span className="tag-muted">transfer</span>}
                    </span>
                  )}
                  {/* Only the columns actually hidden at this width fold in. */}
                  <span className="mt-1 block truncate text-[11.5px] font-medium text-muted md:hidden">
                    {[r.category, r.account, r.person].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 hidden truncate text-[11.5px] font-medium text-muted md:max-lg:block">
                    {[r.account, r.person].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 hidden truncate text-[11.5px] font-medium text-muted lg:max-xl:block">
                    {r.person ?? ""}
                  </span>
                </Td>

                <Td className="hidden text-[13px] text-muted md:table-cell">
                  <span className="block truncate" title={r.category ?? undefined}>{r.category ?? "—"}</span>
                </Td>
                <Td className="hidden text-[13px] text-muted lg:table-cell">
                  <span className="block truncate" title={r.account ?? undefined}>{r.account ?? "—"}</span>
                </Td>
                <Td className="hidden text-[13px] text-muted xl:table-cell">
                  <span className="block truncate" title={r.person ?? undefined}>{r.person ?? "—"}</span>
                </Td>

                <Td
                  className={
                    "num whitespace-nowrap text-right text-[14px] font-bold " +
                    (tx.type === "income" ? "text-good" : "")
                  }
                >
                  {tx.type === "income" ? "+" : ""}
                  {pkr(Number(tx.amount))}
                </Td>

                <Td>
                  <span className="flex items-center justify-end gap-0.5">
                    <Link
                      href={`/ledger/${tx.id}`}
                      aria-label={`Edit ${name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                    >
                      <Pencil size={14} strokeWidth={2.2} />
                    </Link>
                    <ConfirmDelete id={tx.id} label={name} action={deleteTransaction} />
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A column header that is also a sort control. */
function SortTh({
  children,
  href,
  active,
  dir,
  align = "left",
  className = ""
}: {
  children: React.ReactNode;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th className={className}>
      <Link
        href={href}
        className={
          "inline-flex items-center gap-1 transition hover:text-ink " +
          (active ? "text-ink" : "") +
          (align === "right" ? " w-full justify-end" : "")
        }
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <Arrow size={11} strokeWidth={3} className={active ? "opacity-100" : "opacity-0"} />
      </Link>
    </Th>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`eyebrow px-4 py-3 text-muted first:pl-6 last:pr-6 lg:first:pl-8 lg:last:pr-8 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2.5 align-middle first:pl-6 last:pr-6 lg:first:pl-8 lg:last:pr-8 ${className}`}>
      {children}
    </td>
  );
}
