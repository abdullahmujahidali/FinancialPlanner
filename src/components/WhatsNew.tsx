import Link from "next/link";
import { cookies } from "next/headers";
import { LATEST } from "@/lib/releases";
import DismissWhatsNew from "./DismissWhatsNew";
import { Gift } from "lucide-react";

/**
 * A one-line banner until this device has seen the latest release — enough to
 * be noticed, small enough not to push the month off the first screen. The
 * full notes are one tap away on /whats-new.
 */
export default async function WhatsNew() {
  if ((await cookies()).get("seen")?.value === LATEST.id) return null;
  return (
    <DismissWhatsNew id={LATEST.id}>
      <Link href="/whats-new" className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acid text-ink">
          <Gift size={15} strokeWidth={2.5} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold">What&rsquo;s new: {LATEST.title.toLowerCase()}</span>
          <span className="block truncate text-[12.5px] font-medium text-white/60">
            {LATEST.items.length} improvements — tap to see them
          </span>
        </span>
      </Link>
    </DismissWhatsNew>
  );
}
