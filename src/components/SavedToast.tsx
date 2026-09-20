"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";

/**
 * Confirmation that an entry was actually saved.
 *
 * The old flow redirected back to a filled-in form with a small banner at the
 * top of the page — after submitting you are scrolled near the button, so you
 * never saw it and could not tell whether anything happened. This floats above
 * the content, names the amount, and clears itself from the URL.
 */
export default function SavedToast({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  // Drop the ?saved= param so a refresh or a back-navigation doesn't re-toast.
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) return;
    const next = new URLSearchParams(params.toString());
    next.delete("saved");
    router.replace(next.size ? `${path}?${next}` : path, { scroll: false });
  }, [open, params, path, router]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-3 pl-4 pr-3 text-white shadow-soft lg:bottom-8 lg:left-auto lg:right-8 lg:mx-0"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-acid text-ink">
        <Check size={16} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-bold">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
