"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu as MenuIcon, X, Building2, Target, Inbox, Upload, Settings, LogOut, CalendarRange
} from "lucide-react";

const links = [
  { href: "/year", label: "Year overview", Icon: CalendarRange },
  { href: "/assets", label: "Assets", Icon: Building2 },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/review", label: "Review queue", Icon: Inbox },
  { href: "/import", label: "Import bank CSV", Icon: Upload },
  { href: "/settings", label: "Settings", Icon: Settings }
];

/**
 * Phone-only overflow menu.
 *
 * The bottom bar only has room for the daily routes, so everything else —
 * assets, goals, the review queue, import, settings and sign-out — lives here.
 * Without it those pages are unreachable on a phone, since the sidebar that
 * holds them is desktop-only.
 */
export default function MobileMenu({
  household,
  email,
  reviewCount,
  logout
}: {
  household: string;
  email: string;
  reviewCount: number;
  logout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold text-muted transition-colors"
      >
        <MenuIcon size={21} strokeWidth={2} />
        Menu
        <span className="h-[3px] w-5 rounded-full bg-transparent" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[26px] bg-card pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* grab handle */}
            <div className="flex justify-center pb-1 pt-3">
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>

            <div className="flex items-start justify-between gap-3 px-6 pb-5 pt-2">
              <div className="min-w-0">
                <p className="font-display text-[20px] font-extrabold tracking-[-0.02em]">{household}</p>
                <p className="mt-0.5 truncate text-[13px] font-semibold text-muted">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-page text-ink"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <nav className="px-4 pb-4">
              {links.map(({ href, label, Icon }) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={
                      "flex items-center gap-3.5 rounded-[14px] px-4 py-3.5 text-[15px] font-bold transition " +
                      (active ? "bg-ink text-white" : "text-ink hover:bg-page")
                    }
                  >
                    <Icon size={19} strokeWidth={2.2} />
                    <span className="flex-1">{label}</span>
                    {href === "/review" && reviewCount > 0 && (
                      <span className="rounded-full bg-blush px-2.5 py-0.5 text-[12px] font-bold text-ink">
                        {reviewCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="px-4">
              <form action={logout}>
                <button className="flex w-full items-center justify-center gap-2 rounded-full bg-page px-4 py-3.5 text-[15px] font-bold text-ink transition active:scale-[0.98]">
                  <LogOut size={18} strokeWidth={2.2} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
