"use client";
import { useFormStatus } from "react-dom";

/**
 * Submit button that disables itself while its form is in flight.
 *
 * Server actions against a database ~150ms away leave a plain button looking
 * idle mid-request, so people click again — which is how the same comment got
 * posted seven times. Use this for every action that writes.
 */
export default function SubmitButton({
  children,
  className = "btn",
  pendingLabel,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  /** Replaces the label while pending; omit to keep the label and show a spinner. */
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

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
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
