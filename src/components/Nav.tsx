"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", d: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/ledger", label: "Ledger", d: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8M8 16h5" },
  { href: "/entry", label: "Add", d: "M12 5v14M5 12h14" },
  { href: "/assets", label: "Assets", d: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6" },
  { href: "/goals", label: "Goals", d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" }
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-end justify-between px-3">
        {tabs.map((tab) => {
          const active = path === tab.href;
          if (tab.label === "Add") {
            return (
              <Link key={tab.href} href={tab.href} aria-label="Add entry"
                className="-mt-7 mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_18px_rgba(14,110,76,0.4)] transition-transform active:scale-95">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d={tab.d} /></svg>
              </Link>
            );
          }
          return (
            <Link key={tab.href} href={tab.href}
              className={"flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors " + (active ? "text-brand" : "text-muted")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round"><path d={tab.d} /></svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
