"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Inbox } from "lucide-react";
import MobileMenu from "./MobileMenu";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/ledger", label: "Ledger", Icon: BookOpen }
];

/**
 * Bottom tab bar — phones only; desktop navigates from the sidebar.
 *
 * Only the daily routes get a tab. Everything else (assets, goals, import,
 * settings, sign-out) lives behind the Menu sheet — without it those pages are
 * unreachable on a phone, since the sidebar holding them is desktop-only.
 */
export default function Nav({
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
  const path = usePathname();

  const tab = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = path === href;
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
        <span className="relative">
          <Icon size={21} strokeWidth={active ? 2.6 : 2} />
          {!!badge && badge > 0 && (
            <span className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-blush px-1 text-center text-[10px] font-bold leading-[17px] text-ink">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
        {label}
        <span className={"h-[3px] w-5 rounded-full " + (active ? "bg-ink" : "bg-transparent")} />
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-between px-3">
        {tabs.map((t) => tab(t.href, t.label, t.Icon))}

        {/* raised primary action */}
        <Link
          href="/entry"
          aria-label="Add entry"
          className="-mt-6 mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-acid text-ink shadow-soft transition active:scale-95"
        >
          <Plus size={26} strokeWidth={2.75} />
        </Link>

        {tab("/review", "Review", Inbox, reviewCount)}

        <MobileMenu household={household} email={email} reviewCount={reviewCount} logout={logout} />
      </div>
    </nav>
  );
}
