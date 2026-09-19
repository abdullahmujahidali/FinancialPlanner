"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top progress bar for navigations.
 *
 * Every page is `force-dynamic` against a database ~150ms away, so a click can
 * sit for half a second with nothing on screen changing — which reads as "the
 * app ignored me" and makes people click again. This gives that wait a visible
 * home.
 *
 * It listens for link clicks rather than router events, since the App Router
 * exposes no navigation-start hook; the bar clears when the path or query
 * actually changes.
 */
export default function RouteProgress() {
  const path = usePathname();
  const params = useSearchParams();
  const [active, setActive] = useState(false);

  // A completed navigation is the signal to stop.
  useEffect(() => {
    setActive(false);
  }, [path, params]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, or a pure hash change: nothing to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setActive(true);
    }

    // Server actions and form posts also navigate; show the bar for those too.
    function onSubmit() {
      setActive(true);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // Safety net: never leave the bar spinning forever if a navigation is
  // cancelled or a server action resolves without changing the URL.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-transparent">
      <div className="h-full w-2/5 animate-[routebar_1.1s_ease-in-out_infinite] rounded-r-full bg-ink" />
    </div>
  );
}
