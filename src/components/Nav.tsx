import Link from "next/link";

const tabs = [
  { href: "/", label: "Home", d: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/ledger", label: "Ledger", d: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8M8 16h5" },
  { href: "/entry", label: "Add", d: "M12 5v14M5 12h14" },
  { href: "/assets", label: "Assets", d: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6" },
  { href: "/goals", label: "Goals", d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" }
];

export default function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href}
            className={"flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted " + (tab.label === "Add" ? "text-brand" : "")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={tab.label === "Add" ? 2.4 : 1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.d} />
            </svg>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
