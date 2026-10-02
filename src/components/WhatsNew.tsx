import Link from "next/link";
import { cookies } from "next/headers";
import { LATEST } from "@/lib/releases";
import DismissWhatsNew from "./DismissWhatsNew";
import { Gift, ArrowRight } from "lucide-react";

/**
 * Shown on Home until this device has seen the latest release, so changes
 * announce themselves instead of someone having to explain them.
 */
export default async function WhatsNew() {
  if ((await cookies()).get("seen")?.value === LATEST.id) return null;
  return (
    <DismissWhatsNew id={LATEST.id}>
      <section className="overflow-hidden rounded-t-[22px] bg-ink text-white">
        <div className="px-6 pb-2 pt-5 lg:px-7">
          <h2 className="eyebrow flex items-center gap-2 text-acid">
            <Gift size={14} strokeWidth={2.6} /> What&rsquo;s new · {LATEST.date}
          </h2>
          <p className="mt-2 font-display text-[20px] font-extrabold tracking-[-0.02em]">{LATEST.title}</p>
        </div>
        <ul className="px-6 pb-2 lg:px-7">
          {LATEST.items.slice(0, 3).map((it, i) => (
            <li key={i} className="border-b border-white/10 py-3 last:border-0">
              {it.href ? (
                <Link href={it.href} className="flex items-start gap-3 text-[14px] font-medium leading-relaxed text-white/85 hover:text-white">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acid" />
                  <span className="flex-1">{it.text}</span>
                  <ArrowRight size={15} className="mt-1 shrink-0 text-acid" />
                </Link>
              ) : (
                <span className="flex items-start gap-3 text-[14px] font-medium leading-relaxed text-white/85">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acid" />
                  <span className="flex-1">{it.text}</span>
                </span>
              )}
            </li>
          ))}
          {LATEST.items.length > 3 && (
            <li className="py-3">
              <Link href="/whats-new" className="text-[13.5px] font-bold text-acid hover:underline">
                and {LATEST.items.length - 3} more changes →
              </Link>
            </li>
          )}
        </ul>
      </section>
    </DismissWhatsNew>
  );
}
