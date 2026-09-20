"use client";

import { useState } from "react";
import { Pencil, Check, X, Archive, ArchiveRestore } from "lucide-react";

/**
 * A settings list row that can be renamed in place and archived.
 *
 * Settings lists are read far more often than they are edited, so the row
 * shows plain text until you ask for the input. Archive rather than delete is
 * the default everywhere: these rows are referenced by transactions, and a
 * hard delete would orphan history that still has money in it.
 */
export default function EditableRow({
  id,
  name,
  badge,
  archived = false,
  renameAction,
  archiveAction,
  showPassthrough = false,
  passthrough = false
}: {
  id: number;
  name: string;
  badge?: React.ReactNode;
  archived?: boolean;
  renameAction: (formData: FormData) => void;
  archiveAction?: (formData: FormData) => void;
  /** Categories carry a second fact worth editing alongside the name. */
  showPassthrough?: boolean;
  passthrough?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rule-row px-5 py-3 last:border-0 lg:px-6">
        <form
          action={(fd) => {
            renameAction(fd);
            setEditing(false);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            defaultValue={name}
            autoFocus
            required
            className="field min-w-0 flex-1"
            aria-label="Name"
          />
          {showPassthrough && (
            <label className="flex items-center gap-2 whitespace-nowrap text-[12.5px] font-bold">
              <input
                type="checkbox"
                name="passthroughDefault"
                defaultChecked={passthrough}
                className="h-4 w-4 rounded accent-ink"
              />
              Pass-through
            </label>
          )}
          <button className="btn btn-sm shrink-0" aria-label="Save">
            <Check size={15} strokeWidth={2.8} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-quiet btn-sm shrink-0"
            aria-label="Cancel"
          >
            <X size={15} strokeWidth={2.8} />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className={"rule-row flex items-center gap-3 px-5 py-4 last:border-0 lg:px-6 " + (archived ? "opacity-55" : "")}>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{name}</span>
      {badge}
      {archived && <span className="tag-muted shrink-0">archived</span>}

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
      >
        <Pencil size={14} strokeWidth={2.3} />
      </button>

      {archiveAction && (
        <form action={archiveAction} className="shrink-0">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archived" value={archived ? "0" : "1"} />
          <button
            aria-label={archived ? `Restore ${name}` : `Archive ${name}`}
            title={archived ? "Restore" : "Archive — hides it from pickers, keeps the history"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
          >
            {archived ? <ArchiveRestore size={14} strokeWidth={2.3} /> : <Archive size={14} strokeWidth={2.3} />}
          </button>
        </form>
      )}
    </li>
  );
}
