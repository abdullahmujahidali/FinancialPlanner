"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, FileSpreadsheet } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";
import type { ColumnMap, SniffResult } from "@/lib/csv";

/**
 * The two-step import flow: pick an account and a file, then confirm which
 * column of that file is which before anything is written.
 *
 * Sniffing runs server-side (`sniffStatement`) so the browser and the importer
 * agree on where the header is. The preview below repeats a little of the date
 * logic from `src/lib/csv.ts` on purpose — that module hashes rows with
 * node:crypto and can't be pulled into a client bundle. Only the display is
 * duplicated; the import itself is always parsed by `parseWithMap`.
 */

type Field = "date" | "description" | "debit" | "credit" | "amount" | "balance" | "docNo";

const FIELDS: { key: Field; label: string; hint?: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "debit", label: "Debit / withdrawal" },
  { key: "credit", label: "Credit / deposit" },
  { key: "amount", label: "Amount", hint: "one signed column instead of debit + credit" },
  { key: "balance", label: "Running balance" },
  { key: "docNo", label: "Doc / reference no." }
];

const NONE = "";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function fullYear(y: number) {
  return y >= 1000 ? y : y >= 70 ? 1900 + y : 2000 + y;
}

function previewDate(raw: string, format: ColumnMap["dateFormat"]): string | null {
  const v = (raw ?? "").trim().replace(/^"|"$/g, "");
  if (!v) return null;
  const show = (d: number, m: number, y: number) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2999
      ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      : null;

  let m = v.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/,]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mo ? show(Number(m[1]), mo, fullYear(Number(m[3]))) : null;
  }
  m = v.match(/^([A-Za-z]{3,})[\s\-/]+(\d{1,2})[\s\-/,]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mo ? show(Number(m[2]), mo, fullYear(Number(m[3]))) : null;
  }
  m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return show(Number(m[3]), Number(m[2]), Number(m[1]));

  if (format === "ymd") {
    m = v.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return show(Number(m[3]), Number(m[2]), fullYear(Number(m[1])));
  }
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const first = Number(m[1]), second = Number(m[2]), y = fullYear(Number(m[3]));
    // "auto" is a guess from this cell alone; the server decides from the whole
    // file. Prefer day-first (Pakistani banks) unless the numbers rule it out.
    const mdy = format === "mdy" || (format === "auto" && first <= 12 && second > 12);
    return mdy ? show(second, first, y) : show(first, second, y);
  }
  return null;
}

function money(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "—";
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n) || !/\d/.test(v)) return "—";
  const signed = /^\(.*\)$/.test(v) ? -Math.abs(n) : n;
  return signed.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

function MappingFields({
  headers,
  sampleRows,
  guess,
  opening,
  closing,
  onBack
}: {
  headers: string[];
  sampleRows: string[][];
  guess: Partial<ColumnMap>;
  opening: number | null;
  closing: number | null;
  onBack: () => void;
}) {
  const [cols, setCols] = useState<Record<Field, string>>(() => ({
    date: guess.date !== undefined ? String(guess.date) : NONE,
    description: guess.description !== undefined ? String(guess.description) : NONE,
    debit: guess.debit !== undefined ? String(guess.debit) : NONE,
    credit: guess.credit !== undefined ? String(guess.credit) : NONE,
    amount: guess.amount !== undefined ? String(guess.amount) : NONE,
    balance: guess.balance !== undefined ? String(guess.balance) : NONE,
    docNo: guess.docNo !== undefined ? String(guess.docNo) : NONE
  }));
  const [dateFormat, setDateFormat] = useState<ColumnMap["dateFormat"]>(guess.dateFormat ?? "auto");
  const [amountSign, setAmountSign] = useState<NonNullable<ColumnMap["amountSign"]>>(
    guess.amountSign ?? "debit-negative"
  );

  const idx = (f: Field): number | undefined => (cols[f] === NONE ? undefined : Number(cols[f]));
  const usingAmount = idx("amount") !== undefined;

  const hasDate = idx("date") !== undefined;
  const hasDescription = idx("description") !== undefined;
  const hasMoney = idx("debit") !== undefined || idx("credit") !== undefined || usingAmount;
  const valid = hasDate && hasDescription && hasMoney;

  const columnMap: ColumnMap = {
    date: idx("date") ?? -1,
    description: idx("description") ?? -1,
    debit: usingAmount ? undefined : idx("debit"),
    credit: usingAmount ? undefined : idx("credit"),
    amount: idx("amount"),
    balance: idx("balance"),
    docNo: idx("docNo"),
    dateFormat,
    amountSign: usingAmount ? amountSign : undefined
  };

  const preview = useMemo(() => {
    return sampleRows.map(r => {
      const cell = (i: number | undefined) => (i === undefined ? "" : r[i] ?? "");
      let debit = "—", credit = "—";
      if (usingAmount) {
        const raw = cell(idx("amount")).trim();
        const n = Number(raw.replace(/[^0-9.\-]/g, ""));
        const signed = /^\(.*\)$/.test(raw) ? -Math.abs(n) : n;
        if (/\d/.test(raw) && isFinite(signed)) {
          const isDebit = amountSign === "debit-positive" ? signed >= 0 : signed < 0;
          const shown = Math.abs(signed).toLocaleString("en-PK", { maximumFractionDigits: 2 });
          if (isDebit) debit = shown; else credit = shown;
        }
      } else {
        debit = money(cell(idx("debit")));
        credit = money(cell(idx("credit")));
      }
      return {
        date: previewDate(cell(idx("date")), dateFormat),
        rawDate: cell(idx("date")).trim(),
        description: cell(idx("description")).trim(),
        debit,
        credit
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRows, cols, dateFormat, amountSign]);

  const badDates = preview.some(p => !p.date);

  return (
    <div className="space-y-5">
      <input type="hidden" name="columnMap" value={JSON.stringify(columnMap)} />

      <div>
        <h3 className="eyebrow text-muted">Which column is which</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="text-[13px] font-bold">
                {f.label}
                {(f.key === "date" || f.key === "description") && <span className="text-over"> *</span>}
              </span>
              {f.hint && <span className="mt-0.5 block text-[11px] font-medium text-muted">{f.hint}</span>}
              <select
                className="field mt-1.5"
                value={cols[f.key]}
                onChange={e => setCols(c => ({ ...c, [f.key]: e.target.value }))}
              >
                <option value={NONE}>— none —</option>
                {headers.map((h, i) => (
                  <option key={i} value={String(i)}>
                    {h.trim() || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="block">
            <span className="text-[13px] font-bold">Date format</span>
            <select
              className="field mt-1.5"
              value={dateFormat}
              onChange={e => setDateFormat(e.target.value as ColumnMap["dateFormat"])}
            >
              <option value="auto">Auto-detect</option>
              <option value="dmy">DD-MM-YYYY</option>
              <option value="mdy">MM-DD-YYYY</option>
              <option value="ymd">YYYY-MM-DD</option>
            </select>
          </label>

          {usingAmount && (
            <label className="block">
              <span className="text-[13px] font-bold">In the amount column</span>
              <select
                className="field mt-1.5"
                value={amountSign}
                onChange={e => setAmountSign(e.target.value as NonNullable<ColumnMap["amountSign"]>)}
              >
                <option value="debit-negative">Money out is negative</option>
                <option value="debit-positive">Money out is positive</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <div>
        <h3 className="eyebrow text-muted">Preview — first {preview.length} row{preview.length === 1 ? "" : "s"}</h3>
        <div className="mt-3 w-full overflow-x-auto rounded-[14px] bg-page p-1">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead>
              <tr className="eyebrow text-muted">
                <th className="px-3 py-2 font-bold">Date</th>
                <th className="px-3 py-2 font-bold">Description</th>
                <th className="px-3 py-2 text-right font-bold">Out</th>
                <th className="px-3 py-2 text-right font-bold">In</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={i} className={i < preview.length - 1 ? "rule-row" : undefined}>
                  <td className="num px-3 py-2.5 font-semibold whitespace-nowrap">
                    {p.date ?? <span className="text-over">? {p.rawDate || "blank"}</span>}
                  </td>
                  <td className="max-w-[22ch] truncate px-3 py-2.5 font-medium sm:max-w-none">
                    {p.description || <span className="text-muted">blank</span>}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-semibold">{p.debit}</td>
                  <td className="num px-3 py-2.5 text-right font-semibold">{p.credit}</td>
                </tr>
              ))}
              {preview.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 font-medium text-muted">
                    No sample rows found below the header.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {badDates && (
          <p className="mt-3 flex items-center gap-2 rounded-[14px] bg-blush px-4 py-3 text-[13px] font-bold">
            <AlertTriangle size={15} strokeWidth={2.75} className="shrink-0" />
            Some dates didn&apos;t read — try a different date column or format.
          </p>
        )}
        {opening != null && closing != null && (
          <p className="num mt-3 text-[13px] font-medium text-muted">
            Found opening {opening.toLocaleString("en-PK")} and closing {closing.toLocaleString("en-PK")} in the file —
            the balance will be tied out after import.
          </p>
        )}
      </div>

      {!valid && (
        <p className="text-[13px] font-bold text-muted">
          Pick a date column, a description column, and either debit/credit or a single amount column.
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SubmitButton className="btn flex-1" disabled={!valid} pendingLabel="Importing…">
          <Upload size={16} strokeWidth={2.75} />
          Import with these columns
        </SubmitButton>
        <button type="button" className="btn-quiet" onClick={onBack}>
          Choose a different file
        </button>
      </div>
    </div>
  );
}

type Account = { id: number; name: string };

export default function CsvMapper({
  accounts,
  action,
  sniff
}: {
  accounts: Account[];
  /** The `importStatement` server action. */
  action: (formData: FormData) => void | Promise<void>;
  /** The `sniffStatement` server action. */
  sniff: (text: string) => Promise<SniffResult>;
}) {
  const [accountId, setAccountId] = useState(() => (accounts[0] ? String(accounts[0].id) : ""));
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SniffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setResult(null);
    setError(null);
    setFile(picked);
    if (!picked) return;

    const reader = new FileReader();
    reader.onerror = () => setError("Couldn't read that file.");
    reader.onload = () => {
      const text = String(reader.result ?? "");
      startTransition(async () => {
        try {
          const r = await sniff(text);
          if (r.headerIdx === -1) {
            setError("Couldn't find a header row in that file. Is it a CSV export from your bank?");
            return;
          }
          setResult(r);
        } catch {
          setError("Couldn't read that file.");
        }
      });
    };
    reader.readAsText(picked);
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">
        Add a bank account in Settings first.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="eyebrow text-muted">Bank account this statement belongs to</span>
        <select
          name="accountId"
          className="field mt-2"
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow text-muted">Statement CSV — any bank</span>
        <input
          ref={fileInput}
          name="file"
          type="file"
          accept=".csv,text/csv"
          onChange={onPick}
          className="field mt-2 py-2.5"
          required
        />
      </label>

      {pending && (
        <p className="flex items-center gap-2 text-[13px] font-bold text-muted">
          <FileSpreadsheet size={15} strokeWidth={2.75} className="shrink-0" />
          Reading {file?.name}…
        </p>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-[14px] bg-blush px-4 py-3 text-[13px] font-bold">
          <AlertTriangle size={15} strokeWidth={2.75} className="shrink-0" />
          {error}
        </p>
      )}

      {result && !pending && (
        <MappingFields
          headers={result.headers}
          sampleRows={result.sampleRows}
          guess={result.guess}
          opening={result.opening}
          closing={result.closing}
          onBack={reset}
        />
      )}
    </form>
  );
}
