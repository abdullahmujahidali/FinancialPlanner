"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

type Named = { id: number; name: string };

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" }
];

const FLAGS = [
  { value: "review", label: "Needs review" },
  { value: "passthrough", label: "Pass-through" },
  { value: "abnormal", label: "One-off" }
];

/**
 * Ledger filter bar.
 *
 * Every control writes to the URL rather than to local state, so the page stays
 * a server component: the list is re-rendered by the server on each change and
 * any view Tooba lands on is a link she can bookmark or send to Abdullah.
 *
 * The month (`m`) rides along on every navigation — filters narrow a month,
 * they don't replace the month nav. The one exception lives on the server: a
 * non-empty `q` searches across all months.
 */
export default function LedgerFilters({
  categories,
  persons,
  accounts,
  month
}: {
  categories: Named[];
  persons: Named[];
  accounts: Named[];
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const person = params.get("person") || "";
  const acct = params.get("acct") || "";
  const type = params.get("type") || "";
  const flag = params.get("flag") || "";

  const anyActive = Boolean(q || cat || person || acct || type || flag);

  /**
   * How many of the *collapsed* controls are doing something. Search is excluded
   * — it stays visible, so counting it would label a filter the user can see.
   */
  const activeCount = [cat, person, acct, type, flag].filter(Boolean).length;

  /**
   * On a phone the three selects and six chips are a full screen of furniture in
   * front of a list whose job is scanning money, so they start folded away. From
   * `sm:` up the panel is always shown by CSS and this flag stops mattering.
   */
  const [open, setOpen] = useState(false);

  /**
   * The text input is uncontrolled-ish: it holds its own value so typing never
   * waits on a round trip, and only pushes the URL once typing settles.
   */
  const [draft, setDraft] = useState(q);
  const typing = useRef(false);

  // Keep the box in step when the URL changes from elsewhere (Clear, back button).
  useEffect(() => {
    if (!typing.current) setDraft(q);
  }, [q]);

  const push = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      next.set("m", month);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, month, pathname, router]
  );

  // Debounce the search so a five-letter word is one navigation, not five.
  useEffect(() => {
    if (draft === q) return;
    typing.current = true;
    const id = setTimeout(() => {
      typing.current = false;
      push({ q: draft });
    }, 300);
    return () => clearTimeout(id);
  }, [draft, q, push]);

  /** Chips are toggles: clicking the active one clears it. */
  const toggle = (key: string, value: string, currently: string) =>
    push({ [key]: currently === value ? "" : value });

  const clear = () => {
    setDraft("");
    typing.current = false;
    router.replace(`${pathname}?m=${month}`, { scroll: false });
  };

  const chip = (active: boolean) =>
    "rounded-full px-3 py-1.5 text-[13px] font-semibold transition " +
    (active ? "bg-ink text-white" : "bg-page text-ink hover:bg-line");

  return (
    <section className="mb-4 overflow-hidden rounded-[22px] bg-card">
      {/* Search row — the only thing guaranteed to be on screen on a phone */}
      <div className="flex items-center gap-2 px-5 py-3 sm:gap-3 sm:py-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-page px-4 py-2.5">
          <Search size={17} strokeWidth={2.2} className="shrink-0 text-muted" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search descriptions…"
            aria-label="Search descriptions"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Clear search"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-ink"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Phone-only disclosure for everything below. Hidden from `sm:` up,
            where the panel is always open and a toggle would be a dead control. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="ledger-filter-panel"
          className={
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition sm:hidden " +
            (activeCount > 0 ? "bg-ink text-white" : "bg-page text-ink hover:bg-line")
          }
        >
          <SlidersHorizontal size={15} strokeWidth={2.2} />
          Filters
          {activeCount > 0 && <span className="num">· {activeCount}</span>}
          <ChevronDown
            size={14}
            strokeWidth={2.4}
            className={"transition " + (open ? "rotate-180" : "")}
          />
        </button>

        {/* Three controls plus a search box is a squeeze at 390px, so on a
            phone Clear moves inside the panel (below) and only the toggle,
            which already carries the active count, stays in the bar. */}
        {anyActive && (
          <span className="hidden shrink-0 sm:block">
            <button type="button" onClick={clear} className="btn-quiet btn-sm">
              Clear
            </button>
          </span>
        )}
      </div>

      {/* Filter panel — collapsed by default on phones, always open from sm: up. */}
      <div className={(open ? "" : "hidden ") + "rule-row sm:block"} />
      <div
        id="ledger-filter-panel"
        className={
          (open ? "flex " : "hidden ") +
          "flex-col gap-3 px-5 py-4 sm:flex lg:px-6"
        }
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <select
            className="field"
            value={acct}
            aria-label="Filter by account"
            onChange={(e) => push({ acct: e.target.value })}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            className="field"
            value={cat}
            aria-label="Filter by category"
            onChange={(e) => push({ cat: e.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="field"
            value={person}
            aria-label="Filter by person"
            onChange={(e) => push({ person: e.target.value })}
          >
            <option value="">Everyone</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={type === o.value}
              onClick={() => toggle("type", o.value, type)}
              className={chip(type === o.value)}
            >
              {o.label}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-line" aria-hidden />

          {FLAGS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={flag === o.value}
              onClick={() => toggle("flag", o.value, flag)}
              className={chip(flag === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {anyActive && (
          <div className="sm:hidden">
            <button type="button" onClick={clear} className="btn-quiet btn-sm w-full">
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
