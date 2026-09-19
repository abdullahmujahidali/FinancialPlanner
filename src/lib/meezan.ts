import { createHash } from "crypto";

export type StatementRow = {
  bookingDate: string; // YYYY-MM-DD
  docNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  fingerprint: string;
};
export type ParsedStatement = {
  opening: number | null;
  closing: number | null;
  rows: StatementRow[];
  errors: string[];
};

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
}
function num(s: string): number {
  const v = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return isFinite(v) ? v : 0;
}
/** Minimal RFC-4180 line splitter (handles quoted fields with commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Parses a Meezan Bank CSV statement export (preamble rows, then a 'Booking Date' header). */
export function parseMeezan(text: string, householdId: number, accountId: number): ParsedStatement {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/);
  const errors: string[] = [];
  let opening: number | null = null, closing: number | null = null;
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const l = lines[i];
    if (/^Opening Balance/i.test(l)) opening = num(l.split(",")[1] ?? "");
    if (/^Closing Balance/i.test(l)) closing = num(l.split(",")[1] ?? "");
    if (/^Booking Date/i.test(l)) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    return { opening, closing, rows: [], errors: ["Could not find the 'Booking Date' header row — is this a Meezan CSV export?"] };
  }

  const rows: StatementRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = splitCsvLine(lines[i]);
    if (f.length < 7) { errors.push(`Line ${i + 1}: expected 7 columns, got ${f.length}`); continue; }
    const d = parseDate(f[0]);
    if (!d) { errors.push(`Line ${i + 1}: unreadable date "${f[0]}"`); continue; }
    const debit = num(f[4]), credit = num(f[5]);
    const description = f[3].trim();
    const fingerprint = createHash("sha1")
      .update([householdId, accountId, d, f[2].trim(), description, debit.toFixed(2), credit.toFixed(2)].join("|"))
      .digest("hex");
    rows.push({ bookingDate: d, docNo: f[2].trim(), description, debit, credit, balance: f[6] ? num(f[6]) : null, fingerprint });
  }
  return { opening, closing, rows, errors };
}
