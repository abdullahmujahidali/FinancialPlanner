"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Rows3, Table2 } from "lucide-react";

/**
 * Density switch for the ledger.
 *
 * The card list is the readable default — a bank description is often the only
 * handle a row has, and it needs two lines. The table trades that for density:
 * about three times as many rows per screen, which is what you want when
 * reconciling a whole month rather than reading it.
 *
 * The choice lives in the URL so it survives refreshes, is shareable, and is
 * readable by the server component that does the rendering.
 */
export default function ViewToggle({ view }: { view: "list" | "table" }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const go = (next: "list" | "table") => {
    const q = new URLSearchParams(params.toString());
    // "list" is the default, so keep it out of the URL.
    if (next === "list") q.delete("view");
    else q.set("view", next);
    router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };

  return (
    <div
      role="group"
      aria-label="Ledger layout"
      className="flex items-center gap-0.5 rounded-full bg-page p-0.5"
    >
      <Btn active={view === "list"} onClick={() => go("list")} label="List view">
        <Rows3 size={15} strokeWidth={2.4} />
        <span>List</span>
      </Btn>
      <Btn active={view === "table"} onClick={() => go("table")} label="Table view">
        <Table2 size={15} strokeWidth={2.4} />
        <span>Table</span>
      </Btn>
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  children
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition " +
        (active ? "bg-ink text-white" : "text-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
