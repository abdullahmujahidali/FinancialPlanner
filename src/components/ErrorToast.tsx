"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X } from "lucide-react";

/**
 * A form error, shown where the eye already is.
 *
 * Actions report problems by redirecting with `?e=`. As a banner at the top of
 * the page it was invisible on a phone — you submit at the bottom of a long
 * form — so it floats above the tab bar like the saved toast, and clears
 * itself from the URL once dismissed.
 */
export default function ErrorToast({ message }: { message?: string }) {
  const [open, setOpen] = useState(Boolean(message));
  const router = useRouter();

  useEffect(() => setOpen(Boolean(message)), [message]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, [open]);
  // Read the URL directly rather than via useSearchParams, which would need a
  // Suspense boundary on statically rendered pages such as /login.
  useEffect(() => {
    if (open) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("e")) return;
    url.searchParams.delete("e");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [open, router]);

  if (!open || !message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[18px] bg-blush py-3 pl-4 pr-3 text-ink shadow-soft lg:bottom-8 lg:left-auto lg:right-8 lg:mx-0"
    >
      <AlertCircle size={18} strokeWidth={2.5} className="shrink-0" />
      <span className="min-w-0 flex-1 text-[14px] font-bold leading-snug">{message}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-ink/10"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
