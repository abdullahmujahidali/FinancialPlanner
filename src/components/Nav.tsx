"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Building2, Target } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/ledger", label: "Ledger", Icon: BookOpen },
  { href: "/entry", label: "Add", Icon: Plus },
  { href: "/assets", label: "Assets", Icon: Building2 },
  { href: "/goals", label: "Goals", Icon: Target }
];

/** Bottom tab bar — phones only. Desktop navigates from the sidebar. */
export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-between px-3">
        {tabs.map(({ href, label, Icon }) => {
          const active = path === href;
          if (label === "Add") {
            return (
              <Link
                key={href}
                href={href}
                aria-label="Add entry"
                className="-mt-6 mb-1.5 flex h-14 w-14 items-center justify-center border-2 border-line bg-acid text-ink shadow-hard transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Icon size={26} strokeWidth={2.75} />
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors " +
                (active ? "text-ink" : "text-muted")
              }
            >
              <Icon size={21} strokeWidth={active ? 2.75 : 2} />
              {label}
              {/* active marker: a hard lime underline, not a colour shift */}
              <span className={"h-[3px] w-6 " + (active ? "bg-acid" : "bg-transparent")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
