import { createHash } from "crypto";
import type { ParsedStatement, StatementRow } from "./meezan";

export type { ParsedStatement, StatementRow };

/**
 * Which column of the uploaded CSV holds which field. Indexes are into the
 * split header row, so they stay valid for every data line in the same file.
 */
export type ColumnMap = {
  date: number;
  description: number;
  debit?: number;
  credit?: number;
  /** Single signed column, as an alternative to a debit/credit pair. */
  amount?: number;
  balance?: number;
  docNo?: number;
  dateFormat: "auto" | "dmy" | "mdy" | "ymd";
  /** Only meaningful together with `amount`. Defaults to debit-negative. */
  amountSign?: "debit-positive" | "debit-negative";
};

export type SniffResult = {
  headerIdx: number;
  headers: string[];
  sampleRows: string[][];
  opening: number | null;
  closing: number | null;
  guess: Partial<ColumnMap>;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

/** Minimal RFC-4180 line splitter (handles quoted fields with commas). */
export function splitCsvLine(line: string): string[] {
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

/** Same lenient number reading as the Meezan parser: strip currency/commas. */
function num(s: string): number {
  const v = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return isFinite(v) ? v : 0;
}

function looksLikeNumber(s: string): boolean {
  const v = s.trim();
  return v.length > 0 && /\d/.test(v) && /^[^A-Za-z]*$/.test(v);
}

// ---------------------------------------------------------------- date parsing

function fullYear(y: number): number {
  if (y >= 1000) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

/**
 * Split a date string into day / month / year. `resolved` is true when the
 * format itself made the order unambiguous (a month name, or a leading
 * 4-digit year), in which case `day` and `month` are already correct.
 * For a bare `NN/NN/YYYY` they hold the first and second components and the
 * caller decides which is which.
 */
function rawParts(s: string): { day: number; month: number; y: number; resolved: boolean } | null {
  const v = s.trim().replace(/^"|"$/g, "");
  if (!v) return null;

  // DD MMM YYYY / DD-MMM-YY
  let m = v.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/,]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return { day: Number(m[1]), month: Number(mo), y: fullYear(Number(m[3])), resolved: true };
  }
  // MMM DD, YYYY
  m = v.match(/^([A-Za-z]{3,})[\s\-/]+(\d{1,2})[\s\-/,]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return { day: Number(m[2]), month: Number(mo), y: fullYear(Number(m[3])), resolved: true };
  }

  // YYYY-MM-DD / YYYY/MM/DD
  m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return { day: Number(m[3]), month: Number(m[2]), y: Number(m[1]), resolved: true };

  // NN/NN/YY(YY) — ambiguous until the whole file is considered
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return { day: Number(m[1]), month: Number(m[2]), y: fullYear(Number(m[3])), resolved: false };

  return null;
}

/** `YY-MM-DD` — only reachable when the user explicitly picked YYYY-MM-DD. */
function shortYmd(s: string): { day: number; month: number; y: number } | null {
  const m = s.trim().replace(/^"|"$/g, "").match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  return m ? { day: Number(m[3]), month: Number(m[2]), y: fullYear(Number(m[1])) } : null;
}

function iso(day: number, month: number, year: number): string | null {
  if (!(month >= 1 && month <= 12)) return null;
  if (!(day >= 1 && day <= 31)) return null;
  if (!(year >= 1900 && year <= 2999)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse one date cell. `format` of "auto" means: month names and ISO order are
 * already unambiguous, otherwise use the file-wide `inferred` order.
 */
export function parseDateCell(s: string, format: ColumnMap["dateFormat"], inferred: "dmy" | "mdy" = "dmy"): string | null {
  const p = rawParts(s);
  if (!p) return null;
  if (p.resolved) return iso(p.day, p.month, p.y);

  if (format === "ymd") {
    const short = shortYmd(s);
    return short ? iso(short.day, short.month, short.y) : iso(p.day, p.month, p.y);
  }
  const order = format === "auto" ? inferred : format;
  // `day`/`month` still hold the first and second components here.
  return order === "mdy" ? iso(p.month, p.day, p.y) : iso(p.day, p.month, p.y);
}

/**
 * Scan every date cell to decide dd/mm vs mm/dd for this file: if any first
 * component exceeds 12 it must be a day; if any second one does, it's mdy.
 * Ties go to dmy — this is a Pakistani app.
 */
function inferOrder(cells: string[]): "dmy" | "mdy" {
  let firstOver12 = 0, secondOver12 = 0;
  for (const c of cells) {
    const p = rawParts(c);
    if (!p || p.resolved) continue;
    if (p.day > 12) firstOver12++;
    if (p.month > 12) secondOver12++;
  }
  if (secondOver12 > firstOver12) return "mdy";
  return "dmy";
}

// ---------------------------------------------------------------- sniffing

const SYNONYMS: Record<keyof Omit<ColumnMap, "dateFormat" | "amountSign">, RegExp[]> = {
  date: [/^date$/i, /booking/i, /txn\s*date/i, /transaction\s*date/i, /value\s*date/i, /posted/i, /\bdate\b/i],
  description: [/description/i, /narration/i, /particulars/i, /details/i, /remarks/i, /transaction/i],
  debit: [/^debit/i, /withdrawal/i, /\bdr\b/i, /debit/i],
  credit: [/^credit/i, /deposit/i, /\bcr\b/i, /credit/i],
  amount: [/^amount$/i, /amount/i, /^value$/i],
  balance: [/balance/i, /running/i],
  docNo: [/doc/i, /\bref/i, /cheque/i, /stan/i, /instrument/i]
};

function matchHeader(headers: string[], patterns: RegExp[], taken: Set<number>): number | undefined {
  for (const re of patterns) {
    for (let i = 0; i < headers.length; i++) {
      if (taken.has(i)) continue;
      if (re.test(headers[i].trim())) return i;
    }
  }
  return undefined;
}

/**
 * Find the header row in an arbitrary bank CSV and take a best guess at which
 * column is which, plus any opening/closing balance sitting in the preamble.
 */
export function sniffCsv(text: string): SniffResult {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);

  let opening: number | null = null;
  let closing: number | null = null;
  const scanTo = Math.min(lines.length, 25);

  for (let i = 0; i < scanTo; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (/opening/i.test(l) && /\d/.test(l) && opening === null) {
      const v = numberAfterLabel(l);
      if (v !== null) opening = v;
    }
    if (/closing/i.test(l) && /\d/.test(l) && closing === null) {
      const v = numberAfterLabel(l);
      if (v !== null) closing = v;
    }
  }

  // Score candidate header rows: many non-empty, mostly non-numeric cells, and
  // the next non-empty line must look like data (i.e. contain a readable date).
  let headerIdx = -1;
  let best = -1;
  for (let i = 0; i < scanTo; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw).map(c => c.trim());
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) continue;
    const numeric = nonEmpty.filter(looksLikeNumber).length;
    if (numeric > nonEmpty.length / 2) continue;

    // the following non-empty line should parse as data
    let next: string[] | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      next = splitCsvLine(lines[j]);
      break;
    }
    if (!next) continue;
    const hasDate = next.some(c => rawParts(c) !== null);
    if (!hasDate) continue;

    const score = nonEmpty.length * 2 - numeric;
    if (score > best) { best = score; headerIdx = i; }
  }

  if (headerIdx === -1) {
    return { headerIdx: -1, headers: [], sampleRows: [], opening, closing, guess: { dateFormat: "auto" } };
  }

  const headers = splitCsvLine(lines[headerIdx]).map(c => c.trim());
  const sampleRows: string[][] = [];
  for (let i = headerIdx + 1; i < lines.length && sampleRows.length < 3; i++) {
    if (!lines[i].trim()) continue;
    sampleRows.push(splitCsvLine(lines[i]));
  }

  const taken = new Set<number>();
  const guess: Partial<ColumnMap> = { dateFormat: "auto" };
  const date = matchHeader(headers, SYNONYMS.date, taken);
  if (date !== undefined) { guess.date = date; taken.add(date); }
  const description = matchHeader(headers, SYNONYMS.description, taken);
  if (description !== undefined) { guess.description = description; taken.add(description); }
  const balance = matchHeader(headers, SYNONYMS.balance, taken);
  if (balance !== undefined) { guess.balance = balance; taken.add(balance); }
  const debit = matchHeader(headers, SYNONYMS.debit, taken);
  if (debit !== undefined) { guess.debit = debit; taken.add(debit); }
  const credit = matchHeader(headers, SYNONYMS.credit, taken);
  if (credit !== undefined) { guess.credit = credit; taken.add(credit); }
  if (guess.debit === undefined || guess.credit === undefined) {
    const amount = matchHeader(headers, SYNONYMS.amount, taken);
    if (amount !== undefined) { guess.amount = amount; taken.add(amount); guess.amountSign = "debit-negative"; }
  }
  const docNo = matchHeader(headers, SYNONYMS.docNo, taken);
  if (docNo !== undefined) { guess.docNo = docNo; taken.add(docNo); }

  return { headerIdx, headers, sampleRows, opening, closing, guess };
}

/** Pull the balance out of a preamble line like `Opening Balance,"123,456.78"`. */
function numberAfterLabel(line: string): number | null {
  for (const raw of splitCsvLine(line)) {
    const c = raw.trim();
    if (!c || /opening|closing/i.test(c)) continue;
    // A currency-ish cell: digits, optional grouping, an optional PKR/Rs prefix.
    if (/^(?:[A-Za-z]{2,3}\.?\s*)?-?[\d,]+(?:\.\d+)?$/.test(c)) return num(c);
  }
  const m = line.match(/(-?[\d,]+\.?\d*)\s*$/);
  return m && /\d/.test(m[1]) ? num(m[1]) : null;
}

// ---------------------------------------------------------------- parsing

function cell(f: string[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= f.length) return "";
  return f[idx] ?? "";
}

/**
 * Parse any bank CSV given a confirmed column map. Deliberately tolerant of
 * ragged rows: a line is skipped only when the date or the amount can't be
 * read, never merely because the column count differs from the header's.
 *
 * The sha1 fingerprint inputs and their order are byte-identical to
 * `parseMeezan`, so rows imported through either path de-duplicate against
 * each other.
 */
export function parseWithMap(text: string, map: ColumnMap, householdId: number, accountId: number): ParsedStatement {
  const sniff = sniffCsv(text);
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  const errors: string[] = [];
  const rows: StatementRow[] = [];

  const start = sniff.headerIdx === -1 ? 0 : sniff.headerIdx + 1;

  // Decide dd/mm vs mm/dd once, for the whole file.
  const dateCells: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    dateCells.push(cell(splitCsvLine(lines[i]), map.date));
  }
  const inferred = inferOrder(dateCells);

  for (let i = start; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = splitCsvLine(lines[i]);

    const d = parseDateCell(cell(f, map.date), map.dateFormat, inferred);
    if (!d) {
      // Trailing totals / footers are common; only complain about rows that
      // look like they were meant to be data.
      if (f.filter(c => c.trim()).length > 2) {
        errors.push(`Line ${i + 1}: unreadable date "${cell(f, map.date).trim()}"`);
      }
      continue;
    }

    let debit = 0, credit = 0;
    if (map.amount !== undefined) {
      const rawAmt = cell(f, map.amount).trim();
      if (!rawAmt) { errors.push(`Line ${i + 1}: empty amount`); continue; }
      if (!/\d/.test(rawAmt)) { errors.push(`Line ${i + 1}: unreadable amount "${rawAmt}"`); continue; }
      let v = num(rawAmt);
      if (/^\(.*\)$/.test(rawAmt)) v = -Math.abs(v); // (1,234.00) is an accounting negative
      const debitPositive = map.amountSign === "debit-positive";
      if (debitPositive) {
        if (v >= 0) debit = v; else credit = Math.abs(v);
      } else {
        if (v < 0) debit = Math.abs(v); else credit = v;
      }
    } else {
      if (map.debit === undefined && map.credit === undefined) {
        errors.push(`Line ${i + 1}: no amount column mapped`);
        continue;
      }
      const dRaw = cell(f, map.debit), cRaw = cell(f, map.credit);
      // A truncated line stops before its amount columns entirely — that's a
      // stray row, not a genuine zero, so don't import it as 0/0.
      const present = (idx: number | undefined) => idx !== undefined && idx < f.length;
      if (!present(map.debit) && !present(map.credit)) {
        errors.push(`Line ${i + 1}: row ends before the amount columns`);
        continue;
      }
      debit = num(dRaw);
      credit = num(cRaw);
    }

    const docNo = cell(f, map.docNo).trim();
    const description = cell(f, map.description).trim();
    const balRaw = cell(f, map.balance).trim();

    const fingerprint = createHash("sha1")
      .update([householdId, accountId, d, docNo, description, debit.toFixed(2), credit.toFixed(2)].join("|"))
      .digest("hex");

    rows.push({
      bookingDate: d,
      docNo,
      description,
      debit,
      credit,
      balance: balRaw ? num(balRaw) : null,
      fingerprint
    });
  }

  return { opening: sniff.opening, closing: sniff.closing, rows, errors };
}
