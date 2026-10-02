"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, BookOpen, Plus, Building2, Target, Upload, Settings, Inbox, CalendarRange, FolderOpen, Sparkles, LogOut, HandCoins, PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Grouped by how often each page is actually opened. Review is the daily job
 * (it holds every uncategorised import); assets get revalued about quarterly,
 * so they sit under Planning rather than competing for the same attention.
 */
const groups: Array<{ label?: string; items: Array<{ href: string; label: string; Icon: typeof Home }> }> = [
  {
    label: "Daily",
    items: [
      { href: "/", label: "Home", Icon: Home },
      { href: "/ledger", label: "Ledger", Icon: BookOpen },
      { href: "/year", label: "Year", Icon: CalendarRange },
      { href: "/insights", label: "Insights", Icon: Sparkles },
      { href: "/review", label: "Review", Icon: Inbox }
    ]
  },
  {
    label: "Planning",
    items: [
      { href: "/goals", label: "Goals", Icon: Target },
      { href: "/assets", label: "Assets", Icon: Building2 },
      { href: "/loans", label: "Loans", Icon: HandCoins }
    ]
  },
  {
    items: [
      { href: "/import", label: "Import", Icon: Upload },
      { href: "/files", label: "Files", Icon: FolderOpen },
      { href: "/settings", label: "Settings", Icon: Settings }
    ]
  }
];

/** Fixed desktop rail (lg+). Hidden on phones, where Nav takes over. */
export default function Sidebar({
  collapsed: initial = false,
  household,
  userName,
  email,
  logout,
  reviewCount = 0
}: {
  /** Icon-only rail. Remembered in the `sb` cookie so it survives reloads. */
  collapsed?: boolean;
  household: string;
  userName: string;
  email: string;
  logout: () => void;
  reviewCount?: number;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initial);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // The page padding reads --sb from <html data-sb>, so flip that directly
    // rather than waiting for a server round trip.
    if (next) document.documentElement.dataset.sb = "c";
    else delete document.documentElement.dataset.sb;
    document.cookie = `sb=${next ? "c" : ""}; path=/; max-age=31536000; samesite=lax`;
  };

  const item = (href: string, label: string, Icon: typeof Home) => {
    // settings has sub-pages, so match the section rather than the exact path
    const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    const badge = href === "/review" ? reviewCount : 0;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
        className={
          "relative flex items-center gap-3 rounded-[12px] py-2 text-[13.5px] font-bold transition " +
          (collapsed ? "justify-center px-0 " : "px-3 ") +
          (active ? "bg-ink text-white" : "text-ink/60 hover:bg-card hover:text-ink")
        }
      >
        <Icon size={18} strokeWidth={2.3} className="shrink-0" />
        {!collapsed && <span className="flex-1">{label}</span>}
        {badge > 0 && (
          <span
            className={
              "rounded-full px-1.5 text-[10.5px] font-bold " +
              (collapsed ? "absolute -right-0.5 -top-0.5 " : "") +
              (active ? "bg-acid text-ink" : "bg-blush text-ink")
            }
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sb)] flex-col overflow-y-auto bg-page px-3 py-5 transition-[width] duration-200 lg:flex">
      {/*
        The household leads, not the product name: which book this is is the
        fact worth reading first. The mark doubles as the way home.
      */}
      <div className={"mb-5 flex items-center gap-2 " + (collapsed ? "flex-col" : "px-1")}>
        <Link href="/" aria-label="Home" className="shrink-0 rounded-[10px] p-1 transition hover:bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-mark.png" alt="" width={28} height={20} />
        </Link>
        {!collapsed && (
          <p className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold tracking-[-0.02em] text-ink">
            {household}
          </p>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-card hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen size={17} strokeWidth={2.2} /> : <PanelLeftClose size={17} strokeWidth={2.2} />}
        </button>
      </div>

      <Link
        href="/entry"
        aria-label="Add entry"
        title={collapsed ? "Add entry" : undefined}
        className={
          "mb-5 flex items-center justify-center gap-2 rounded-full bg-acid text-[14px] font-bold text-ink transition hover:bg-aciddim active:scale-[0.98] " +
          (collapsed ? "mx-auto h-11 w-11" : "px-4 py-2.5")
        }
      >
        <Plus size={18} strokeWidth={3} /> {!collapsed && "Add entry"}
      </Link>

      <nav className="flex flex-1 flex-col">
        {groups.map((g, i) => (
          <div key={i} className={i > 0 ? "mt-4" : ""}>
            {g.label && !collapsed ? (
              <p className="eyebrow mb-1 px-3 text-[10px] text-muted">{g.label}</p>
            ) : i > 0 ? (
              <div className="mx-2 mb-3 border-t border-line" />
            ) : null}
            <div className="flex flex-col gap-0.5">
              {g.items.map((m) => item(m.href, m.label, m.Icon))}
            </div>
          </div>
        ))}
      </nav>

      <div className={"mt-4 flex items-center gap-2 border-t border-line pt-3 " + (collapsed ? "flex-col" : "px-1")}>
        <span
          aria-hidden
          title={collapsed ? `${userName} · ${email}` : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-acid"
        >
          {(userName || email || "?").trim().charAt(0).toUpperCase()}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink" title={email}>{userName}</span>
        )}
        <form action={logout}>
          <button aria-label="Sign out" title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-card hover:text-ink">
            <LogOut size={15} strokeWidth={2.3} />
          </button>
        </form>
      </div>
    </aside>
  );
}
