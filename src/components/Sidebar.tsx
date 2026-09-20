"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Building2, Target, Upload, Settings, Inbox, CalendarRange, FolderOpen, Sparkles } from "lucide-react";

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
      { href: "/assets", label: "Assets", Icon: Building2 }
    ]
  },
  {
    items: [
      { href: "/import", label: "Import CSV", Icon: Upload },
      { href: "/files", label: "Files", Icon: FolderOpen },
      { href: "/settings", label: "Settings", Icon: Settings }
    ]
  }
];

/** Fixed desktop rail (lg+). Hidden on phones, where Nav takes over. */
export default function Sidebar({ household, reviewCount = 0 }: { household: string; reviewCount?: number }) {
  const path = usePathname();

  const item = (href: string, label: string, Icon: typeof Home) => {
    // settings has sub-pages, so match the section rather than the exact path
    const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    const badge = href === "/review" ? reviewCount : 0;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={
          "flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-bold transition " +
          (active ? "bg-ink text-white" : "text-ink/60 hover:bg-card hover:text-ink")
        }
      >
        <Icon size={18} strokeWidth={2.4} />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span
            className={
              "rounded-full px-2 text-[11px] font-bold " +
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
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[256px] flex-col bg-page px-5 py-7 lg:flex">
      <Link href="/" className="mb-8 block">
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-mark.png" alt="" width={36} height={25} className="shrink-0" />
          <span className="font-display text-[19px] font-extrabold tracking-tight text-ink">Trusses</span>
        </span>
        <span className="mt-2 block truncate text-[12px] font-semibold text-muted">{household}</span>
      </Link>

      <Link
        href="/entry"
        className="mb-7 flex items-center justify-center gap-2 rounded-full bg-acid px-4 py-3.5 text-[15px] font-bold text-ink transition hover:bg-aciddim active:scale-[0.98]"
      >
        <Plus size={19} strokeWidth={3} /> Add entry
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {groups.map((g, i) => (
          <div key={i} className={i > 0 ? "mt-5" : ""}>
            {g.label ? (
              <p className="eyebrow mb-1.5 px-4 text-muted">{g.label}</p>
            ) : (
              <div className="mb-4 border-t border-line" />
            )}
            <div className="flex flex-col gap-1">
              {g.items.map((m) => item(m.href, m.label, m.Icon))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
