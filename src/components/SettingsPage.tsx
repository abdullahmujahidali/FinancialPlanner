import Link from "next/link";
import Shell from "./Shell";
import { ChevronLeft } from "lucide-react";

/**
 * Frame for a single settings topic.
 *
 * Each topic gets its own route and its own card, so a screen only ever asks
 * one question — the previous all-in-one page put six unrelated forms on one
 * scroll, which is hard to navigate for anyone who isn't the person who built it.
 *
 * Back sits to the LEFT of the title, where back navigation is expected, and
 * the description column is width-limited for readability while the content
 * below it can use the full page.
 */
export default async function SettingsPage({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Shell
      wide
      titleSlot={
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/settings"
            aria-label="Back to settings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink transition hover:bg-page"
          >
            <ChevronLeft size={19} strokeWidth={2.4} />
          </Link>
          <h1 className="min-w-0 truncate font-display text-[26px] font-extrabold tracking-[-0.03em] lg:text-[34px]">
            {title}
          </h1>
        </div>
      }
      title={title}
    >
      {description && (
        <p className="-mt-2 mb-6 max-w-[68ch] text-[15px] leading-relaxed text-muted">{description}</p>
      )}
      {children}
    </Shell>
  );
}
