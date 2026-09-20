import Shell from "./Shell";

/**
 * Frame for a single settings topic.
 *
 * Each topic gets its own route and its own card, so a screen only ever asks
 * one question — the previous all-in-one page put six unrelated forms on one
 * scroll, which is hard to navigate for anyone who isn't the person who built it.
 *
 * Back sits to the LEFT of the title, where back navigation is expected, and
 * names the place it returns to rather than being a bare chevron. The
 * description column is width-limited for readability while the content below
 * it can use the full page.
 */
export default async function SettingsPage({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Shell wide back={{ href: "/settings", label: "Settings" }} title={title}>
      {/* A settings topic is a single list or form — capped so rows don't
          stretch to 1500px with the value miles from its label. */}
      <div className="max-w-[860px]">
        {description && (
          <p className="-mt-2 mb-6 text-[15px] leading-relaxed text-muted">{description}</p>
        )}
        {children}
      </div>
    </Shell>
  );
}
