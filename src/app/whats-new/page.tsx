import Link from "next/link";
import Shell from "@/components/Shell";
import { RELEASES } from "@/lib/releases";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

/** Every update, newest first — the place to look back at what changed. */
export default async function WhatsNewPage() {
  return (
    <Shell back={{ href: "/", label: "Home" }} title="What's new">
      <div className="space-y-5">
        {RELEASES.map((r) => (
          <section key={r.id} className="zone-card">
            <p className="eyebrow text-muted">{r.date}</p>
            <h2 className="mt-1 text-[20px] font-extrabold">{r.title}</h2>
            <ul className="mt-3">
              {r.items.map((it, i) => (
                <li key={i} className="rule-row py-3 last:border-0">
                  {it.href ? (
                    <Link href={it.href} className="flex items-start gap-3 text-[14.5px] font-medium leading-relaxed hover:underline">
                      <span className="flex-1">{it.text}</span>
                      <ArrowRight size={15} className="mt-1 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-[14.5px] font-medium leading-relaxed">{it.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}
