"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

/**
 * Submit button that disables itself while its form is in flight, then says
 * "Saved" for a moment.
 *
 * Server actions against a database ~150ms away leave a plain button looking
 * idle mid-request, so people click again — which is how the same comment got
 * posted seven times, and how a payment gets recorded twice. Use this for
 * every action that writes.
 *
 * The confirmation is skipped when the action came back with `?e=` (it failed
 * and redirected with a message), so it never claims a save that didn't happen.
 */
export default function SubmitButton({
  children,
  className = "btn",
  pendingLabel,
  savedLabel = "Saved",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  /** Replaces the label while pending; omit to keep the label and show a spinner. */
  pendingLabel?: string;
  /** Shown briefly after success; pass "" for buttons where it makes no sense. */
  savedLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (was.current && !pending && savedLabel && !new URL(window.location.href).searchParams.has("e")) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1800);
      was.current = pending;
      return () => clearTimeout(t);
    }
    was.current = pending;
  }, [pending, savedLabel]);

  return (
    <button
      {...rest}
      type="submit"
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={className + " disabled:cursor-not-allowed disabled:opacity-60"}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      )}
      {!pending && saved && <Check size={16} strokeWidth={3} aria-hidden />}
      <span aria-live="polite">
        {pending && pendingLabel ? pendingLabel : !pending && saved ? savedLabel : children}
      </span>
    </button>
  );
}
