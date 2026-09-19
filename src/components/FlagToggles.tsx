"use client";
import { useState } from "react";
import { Check } from "lucide-react";

type FlagName = "isAbnormal" | "isPassthrough" | "needsReview";

const FLAGS: Array<{ name: FlagName; label: string; onClass: string }> = [
  { name: "isAbnormal", label: "One-off / abnormal", onClass: "bg-ink text-white" },
  { name: "isPassthrough", label: "Pass-through (reimbursed)", onClass: "bg-ink text-white" },
  { name: "needsReview", label: "Flag a question", onClass: "bg-blush text-ink" }
];

/**
 * The three transaction flags as toggle chips.
 *
 * Each chip wraps a real (visually hidden) checkbox keeping the original field
 * name, so the form still posts isAbnormal / isPassthrough / needsReview
 * exactly as the bare checkboxes did.
 */
export default function FlagToggles({
  defaults
}: {
  defaults?: Partial<Record<FlagName, boolean>>;
}) {
  const [on, setOn] = useState<Record<FlagName, boolean>>({
    isAbnormal: defaults?.isAbnormal ?? false,
    isPassthrough: defaults?.isPassthrough ?? false,
    needsReview: defaults?.needsReview ?? false
  });

  return (
    <fieldset className="rounded-[22px] bg-card p-6 lg:p-8">
      <legend className="eyebrow text-muted">Flags</legend>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {FLAGS.map((f) => {
          const active = on[f.name];
          return (
            <label
              key={f.name}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold transition select-none ${
                active ? f.onClass : "bg-page text-muted hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                name={f.name}
                checked={active}
                onChange={(e) => setOn((prev) => ({ ...prev, [f.name]: e.target.checked }))}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition ${
                  active ? "bg-white/20" : "bg-ink/10"
                }`}
              >
                {active && <Check size={11} strokeWidth={3.2} />}
              </span>
              {f.label}
            </label>
          );
        })}
      </div>

      <p className="mt-3.5 text-[13px] text-muted">
        Pass-through is a bill someone reimburses you for — it is left out of budget totals.
      </p>
    </fieldset>
  );
}
