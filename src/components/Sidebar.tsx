"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Building2, Target, Upload, Settings, Inbox } from "lucide-react";

const main = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/ledger", label: "Ledger", Icon: BookOpen },
  { href: "/assets", label: "Assets", Icon: Building2 },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/review", label: "Review", Icon: Inbox }
];
const secondary = [
  { href: "/import", label: "Import CSV", Icon: Upload },
  { href: "/settings", label: "Settings", Icon: Settings }
];

/** Fixed desktop rail (lg+). Hidden on phones, where Nav takes over. */
export default function Sidebar({ household, reviewCount = 0 }: { household: string; reviewCount?: number }) {
  const path = usePathname();

  const item = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = path === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={
          "flex items-center gap-3 border-2 px-3 py-2.5 text-[14px] font-bold transition-all " +
          (active
            ? "border-line bg-acid text-ink shadow-hardsm"
            : "border-transparent text-ink/70 hover:border-line hover:bg-card")
        }
      >
        <Icon size={18} strokeWidth={2.4} />
        <span className="flex-1">{label}</span>
        {!!badge && badge > 0 && (
          <span className="border-2 border-line bg-blush px-1.5 text-[11px] font-bold text-ink">{badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r-2 border-line bg-paper px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 block">
        <span className="block border-2 border-line bg-ink px-3 py-2 font-display text-[19px] font-extrabold tracking-tight text-acid">
          Hearthbook
        </span>
        <span className="mt-2 block truncate text-[12px] font-semibold text-muted">{household}</span>
      </Link>

      <Link
        href="/entry"
        className="mb-6 flex items-center justify-center gap-2 border-2 border-line bg-acid px-4 py-3 text-[15px] font-bold text-ink shadow-hard transition-all hover:shadow-hardlg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <Plus size={19} strokeWidth={3} /> Add entry
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {main.map((m) => item(m.href, m.label, m.Icon, m.href === "/review" ? reviewCount : undefined))}
        <div className="my-3 border-t-2 border-line/15" />
        {secondary.map((m) => item(m.href, m.label, m.Icon))}
      </nav>
    </aside>
  );
}
