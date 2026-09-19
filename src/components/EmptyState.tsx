import type { LucideIcon } from "lucide-react";

/**
 * The "nothing here yet" surface.
 *
 * A bare sentence in a box reads like a bug; this reads like a state. One
 * circular icon badge, one bold line saying what is missing, one muted line
 * saying what the thing IS and why it is worth adding — then an optional
 * action. `acid` tone is for the happy empty (an emptied queue), `plain` for
 * the not-started-yet empty.
 */
export default function EmptyState({
  Icon,
  title,
  body,
  action,
  tone = "plain"
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: "plain" | "acid";
}) {
  const acid = tone === "acid";

  return (
    <section
      className={
        "flex flex-col items-center rounded-[22px] px-6 py-12 text-center lg:px-10 lg:py-16 " +
        (acid ? "bg-acid text-ink" : "bg-card text-ink")
      }
    >
      <span
        className={
          "flex items-center justify-center rounded-full p-4 " +
          (acid ? "bg-ink text-acid" : "bg-page text-ink")
        }
      >
        <Icon size={26} strokeWidth={2.4} />
      </span>

      <h2 className="mt-5 font-display text-[20px] font-extrabold tracking-[-0.03em]">{title}</h2>

      <p
        className={
          "mt-2 max-w-[46ch] text-[14px] font-medium leading-relaxed " +
          (acid ? "text-ink/65" : "text-muted")
        }
      >
        {body}
      </p>

      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
