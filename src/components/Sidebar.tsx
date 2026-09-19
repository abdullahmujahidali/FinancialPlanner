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
          "flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-bold transition " +
          (active ? "bg-ink text-white" : "text-ink/60 hover:bg-card hover:text-ink")
        }
      >
        <Icon size={18} strokeWidth={2.4} />
        <span className="flex-1">{label}</span>
        {!!badge && badge > 0 && (
          <span className="rounded-full bg-blush px-2 text-[11px] font-bold text-ink">{badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[256px] flex-col bg-page px-5 py-7 lg:flex">
      <Link href="/" className="mb-8 block">
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={34} height={34} className="shrink-0 rounded-[10px]" />
          <span className="font-display text-[19px] font-extrabold tracking-tight text-ink">Hearthbook</span>
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
        {main.map((m) => item(m.href, m.label, m.Icon, m.href === "/review" ? reviewCount : undefined))}
        <div className="my-4 border-t border-line" />
        {secondary.map((m) => item(m.href, m.label, m.Icon))}
      </nav>
    </aside>
  );
}
