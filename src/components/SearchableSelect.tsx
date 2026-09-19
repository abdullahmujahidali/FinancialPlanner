"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

type Option = { id: number; name: string };

/**
 * A searchable picker that submits a plain value.
 *
 * The native <select> renders the OS dropdown — unsearchable, and visually
 * foreign next to the rest of the UI. This keeps a hidden input carrying the
 * chosen id, so the server action reads exactly the same field name as before
 * and nothing downstream has to change.
 *
 * Hand-rolled rather than HeroUI's ComboBox because the "create it right here"
 * row is a free-text affordance the library's list model fights.
 */
export default function SearchableSelect({
  name,
  label,
  options,
  defaultValue = null,
  placeholder = "Search…",
  emptyLabel,
  allowCreate,
  hint
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: number | null;
  placeholder?: string;
  /** Label for the "no selection" row, e.g. "Household" or "—". Omit to require a choice. */
  emptyLabel?: string;
  allowCreate?: {
    action: (fd: FormData) => Promise<{ id: number; name: string } | void>;
    label: string;
  };
  hint?: React.ReactNode;
}) {
  // Locally-created options live here so a fresh category is selectable at once
  // without waiting for the page to revalidate.
  const [extra, setExtra] = useState<Option[]>([]);
  const all = [...options, ...extra.filter((e) => !options.some((o) => o.id === e.id))];

  const [selected, setSelected] = useState<number | null>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selectedName = all.find((o) => o.id === selected)?.name ?? "";
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;

  // Exact-name hit means "create" would be a duplicate, so the row is hidden.
  const canCreate =
    !!allowCreate && q.length > 0 && !all.some((o) => o.name.toLowerCase() === q);

  // Rows, in the order the arrow keys walk them.
  type Row = { kind: "empty" } | { kind: "option"; option: Option } | { kind: "create" };
  const rows: Row[] = [
    ...(emptyLabel !== undefined && !q ? [{ kind: "empty" } as Row] : []),
    ...matches.map((option) => ({ kind: "option", option }) as Row),
    ...(canCreate ? [{ kind: "create" } as Row] : [])
  ];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function choose(id: number | null) {
    setSelected(id);
    close();
  }

  async function create() {
    if (!allowCreate) return;
    const value = query.trim();
    if (!value) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("name", value);
      const made = await allowCreate.action(fd);
      if (made) {
        setExtra((prev) => [...prev, made]);
        setSelected(made.id);
      }
      close();
    } finally {
      setCreating(false);
    }
  }

  function pick(row: Row) {
    if (row.kind === "empty") choose(null);
    else if (row.kind === "option") choose(row.option.id);
    else void create();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (rows.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      // Never let Enter in the search box submit the outer form.
      e.preventDefault();
      if (!open) setOpen(true);
      else if (rows[active]) pick(rows[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === "Tab") {
      if (open) close();
    }
  }

  return (
    <div className="block">
      <span className="eyebrow text-muted">
        {label}
        {hint}
      </span>

      <input type="hidden" name={name} value={selected === null ? "" : String(selected)} />

      <div ref={rootRef} className="relative mt-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={label}
            value={open ? query : selectedName}
            placeholder={open ? placeholder : selectedName || emptyLabel || placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="field cursor-pointer pr-10"
          />
          <ChevronDown
            size={16}
            strokeWidth={2.2}
            aria-hidden
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition ${open ? "rotate-180" : ""}`}
          />
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-[14px] bg-card p-1.5 shadow-soft"
          >
            {rows.length === 0 && (
              <li className="px-3 py-2.5 text-[14px] text-muted">No matches</li>
            )}

            {rows.map((row, i) => {
              const on = i === active;
              const base = `flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold transition ${
                on ? "bg-ink text-white" : "hover:bg-page"
              }`;

              if (row.kind === "create") {
                return (
                  <li key="create" role="option" aria-selected={false}>
                    <button
                      type="button"
                      disabled={creating}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => void create()}
                      className={`${base} disabled:opacity-50`}
                    >
                      <Plus size={15} strokeWidth={2.4} className="shrink-0" />
                      <span className="truncate">
                        {allowCreate!.label} “{query.trim()}”
                      </span>
                    </button>
                  </li>
                );
              }

              const isEmptyRow = row.kind === "empty";
              const id = isEmptyRow ? null : row.option.id;
              const text = isEmptyRow ? emptyLabel! : row.option.name;
              return (
                <li key={isEmptyRow ? "__empty" : id!} role="option" aria-selected={selected === id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(id)}
                    className={base}
                  >
                    <span className={`truncate ${isEmptyRow && !on ? "text-muted" : ""}`}>{text}</span>
                    {selected === id && (
                      <Check size={15} strokeWidth={2.6} className="ml-auto shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
