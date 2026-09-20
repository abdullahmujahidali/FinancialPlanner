"use client";

import { useState } from "react";
import { pkr } from "@/lib/money";
import { Wallet, ChevronDown } from "lucide-react";

/**
 * Sets the one figure a ledger cannot derive: what an account held before the
 * first entry.
 *
 * It stays folded away because it is set once and then forgotten — the
 * balance it produces is what people come back to read. Opened, it shows the
 * arithmetic in full, because a balance nobody can check is a balance nobody
 * trusts.
 */
export default function OpeningBalance({
  id,
  name,
  kind,
  opening,
  openingDate,
  movement,
  balance,
  action
}: {
  id: number;
  name: string;
  /** A cash wallet is counted, not looked up, so it asks differently. */
  kind?: string;
  opening: number | null;
  openingDate: string | null;
  movement: number;
  balance: number | null;
  action: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const unset = opening == null;

  return (
    <div className="px-5 pb-4 lg:px-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[12.5px] font-bold transition " +
          (unset ? "bg-blush/25 text-ink hover:bg-blush/40" : "bg-page text-muted hover:text-ink")
        }
      >
        <Wallet size={13} strokeWidth={2.5} />
        <span className="flex-1">
          {unset
            ? kind === "cash"
              ? "Count the wallet once to start tracking it"
              : "Set the opening balance to see what's in this account"
            : `Opening ${pkr(opening)}${openingDate ? ` on ${openingDate}` : ""}`}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2.8}
          className={"transition " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-[14px] bg-page p-4">
          {/* The arithmetic, spelled out — a balance you cannot check is one
              you cannot trust. */}
          {!unset && (
            <dl className="mb-4 space-y-1.5 text-[12.5px] font-semibold">
              <Row label="Opening" value={pkr(opening)} />
              <Row
                label="Movement since"
                value={`${movement >= 0 ? "+" : "−"}${pkr(Math.abs(movement))}`}
              />
              <div className="my-2 h-px bg-line" />
              <Row label="Balance now" value={pkr(balance ?? 0)} strong />
            </dl>
          )}

          <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={id} />
            <label className="min-w-0 flex-1">
              <span className="eyebrow mb-1 block text-muted">Opening balance</span>
              <input
                name="openingBalance"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={opening ?? ""}
                placeholder="e.g. 250000"
                className="field"
                aria-label={`Opening balance for ${name}`}
              />
            </label>
            <label className="min-w-0 basis-[150px]">
              <span className="eyebrow mb-1 block text-muted">As of</span>
              <input
                name="openingDate"
                type="date"
                defaultValue={openingDate ?? ""}
                className="field"
                aria-label={`Opening date for ${name}`}
              />
            </label>
            <button className="btn btn-sm shrink-0">Save</button>
          </form>

          <p className="mt-3 text-[11.5px] font-medium leading-relaxed text-muted">
            {kind === "cash"
              ? "Count what is actually in the wallet today and put today's date. "
              : "Whatever the statement said on that date. "}
            Everything after it is already in the ledger, so the balance keeps itself up to
            date from here. Leave it blank to go back to not knowing.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "text-ink" : "text-muted"}>{label}</dt>
      <dd className={"money " + (strong ? "text-[15px] font-extrabold" : "font-bold text-muted")}>
        {value}
      </dd>
    </div>
  );
}
