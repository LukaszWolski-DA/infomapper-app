"use client";

// Back and Forward (slice 6b, D-38; prototype renderNavBar `data-nav`): two buttons at the left end of the breadcrumbs
// row, before the breadcrumbs, and Alt+←/→. They walk the browser's own history, the one history (step 1, section 8),
// so the browser's back, the mouse's back and forward buttons, the keys and the buttons agree. Whether there is
// somewhere to go is the Navigation API's (`canGoBack`, `canGoForward`; entries of another site do not count); without
// the API the buttons are hidden and the keys are left to the browser (Łukasz's step 1 answer 2).
// Every Back or Forward first blurs a focused text field, so its edit saves as on any click (answer 8: a field removed
// by the navigation would otherwise never see its blur). After a traversal that lands on another page, that page is
// refreshed in the background (answer 6): Next.js restores it from its client cache, which may be older than the data.
// The buttons re-render only themselves (a store of the Navigation API's state) and read no layout.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { navigationApi, prunePlaces } from "@/ui/history-places";

/** "hidden" without the Navigation API, else whether Back and Forward can go: "00", "10", "01", "11". */
function snapshot(): string {
  const nav = navigationApi();
  return nav ? `${nav.canGoBack ? 1 : 0}${nav.canGoForward ? 1 : 0}` : "hidden";
}

function subscribe(onChange: () => void): () => void {
  const nav = navigationApi();
  if (!nav) return () => {};
  const changed = () => {
    // the places of entries no longer in this tab's history go (step 1, answer 1)
    try {
      prunePlaces(window.sessionStorage, nav.entries().map((e) => e.key));
    } catch {
      // blocked storage: nothing to prune
    }
    onChange();
  };
  nav.addEventListener("currententrychange", changed);
  return () => nav.removeEventListener("currententrychange", changed);
}

const isTextField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

/** A focused text field loses the focus, so it saves its edit before the navigation removes it. */
export function blurTextField(): void {
  const el = document.activeElement;
  if (isTextField(el)) el.blur();
}

/** One step back (-1) or forward (1) in the browser's history. */
export function historyStep(step: -1 | 1): void {
  blurTextField();
  if (step < 0) window.history.back();
  else window.history.forward();
}

// The page a traversal left, kept outside React: the row (and this component) may be drawn anew for the page it lands
// on. Set on `popstate` from the page shown before it (`lastPath`); the page drawn after it refreshes once when it is
// another page.
let leftPath: string | null = null;
let lastPath: string | null = null;

export function HistoryNav() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "00");
  const router = useRouter();
  const pathname = usePathname();
  const hidden = state === "hidden";

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      // in a text field the browser's own behaviour applies (Windows: back; macOS: a word)
      if (isTextField(e.target as Element | null)) return;
      // one press is one step, also where the browser would go back itself; a focused grip does not resize
      e.preventDefault();
      e.stopImmediatePropagation();
      const nav = navigationApi();
      if (e.key === "ArrowLeft" ? nav?.canGoBack : nav?.canGoForward) historyStep(e.key === "ArrowLeft" ? -1 : 1);
    };
    // A traversal (the browser's back, the mouse's buttons, Alt+← in a field on Windows) blurs the focused field itself
    // when it starts, and an edit blurred that way never reaches its save (slice 6b, step 2: measured). The Navigation
    // API's `navigate` event comes first: blurring there saves the edit as a click would.
    const nav = navigationApi();
    const onNavigate = (e: Event) => {
      if ((e as Event & { navigationType?: string }).navigationType === "traverse") blurTextField();
    };
    const onPop = () => {
      blurTextField();
      leftPath = leftPath ?? lastPath;
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("popstate", onPop);
    nav?.addEventListener("navigate", onNavigate);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("popstate", onPop);
      nav?.removeEventListener("navigate", onNavigate);
    };
  }, [hidden]);

  useEffect(() => {
    if (leftPath !== null && leftPath !== pathname) router.refresh();
    leftPath = null;
    lastPath = pathname;
  }, [pathname, router]);

  if (hidden) return null;
  return (
    <div data-testid="nav-history" className="flex flex-none items-center gap-0.5">
      <NavButton step={-1} enabled={state[0] === "1"} />
      <NavButton step={1} enabled={state[1] === "1"} />
    </div>
  );
}

function NavButton({ step, enabled }: { step: -1 | 1; enabled: boolean }) {
  const back = step < 0;
  return (
    <button
      type="button"
      data-testid={back ? "button-back" : "button-forward"}
      title={back ? "Back (Alt+←)" : "Forward (Alt+→)"}
      aria-label={back ? "Back" : "Forward"}
      disabled={!enabled}
      onClick={() => historyStep(step)}
      className="grid size-6 flex-none place-items-center rounded text-im-ink-2 hover:bg-im-surface hover:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        <path d={back ? "M10 3.5L5.5 8l4.5 4.5" : "M6 3.5L10.5 8 6 12.5"} />
      </svg>
    </button>
  );
}
