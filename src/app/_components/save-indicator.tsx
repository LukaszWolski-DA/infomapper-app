"use client";

// The top bar's save indicator and server badge (slice 30, Q6, Q7, D-84 as proposed; the accepted prototype's `.savest`
// and `.srvb`): before the details panel's button, or the user indicator where there is none; in the document editor's
// own bar before its options panel's button (F16, the main bar leaves them out there). The indicator reads the page's
// save state (`src/ui/save-state.ts`) and nothing else, so no other part of the page re-renders when it changes; it reads
// no layout. Up to 1,500 px the badge shows its short label and the indicator takes less room.

import { useSyncExternalStore } from "react";
import { cn } from "@/ui/lib/utils";
import { failureText, saveState } from "@/ui/save-state";

export type ServerKind = { kind: "local" } | { kind: "online"; name: string | null };

const CHECK = (
  <svg viewBox="0 0 16 16" aria-hidden className="size-[13px] flex-none fill-none stroke-current stroke-[1.7]">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const WARN = (
  <svg viewBox="0 0 16 16" aria-hidden className="size-[13px] flex-none fill-none stroke-current stroke-[1.7]">
    <path d="M8 2.5L14.5 13.5h-13z M8 6.5v3.5 M8 11.8v.2" />
  </svg>
);

export function SaveIndicator() {
  const { phase, failure } = useSyncExternalStore(saveState.subscribe, saveState.getSnapshot, saveState.getServerSnapshot);
  const shown = phase === "saving" || phase === "saved" || phase === "failed";
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="indicator-save"
      data-state={phase}
      title={phase === "failed" && failure ? failureText(failure) : undefined}
      className={cn(
        "inline-flex h-[30px] min-w-[66px] flex-none items-center justify-end gap-1 text-xs text-im-ink-3 max-[1501px]:min-w-[58px]",
        shown ? "opacity-100" : "opacity-0 transition-opacity duration-[600ms]",
        phase === "failed" && "cursor-help font-medium text-im-warn",
      )}
    >
      {phase === "saving" && "Saving…"}
      {(phase === "saved" || phase === "fading") && (
        <>
          {CHECK}
          Saved
        </>
      )}
      {phase === "failed" && (
        <>
          {WARN}
          Not saved
        </>
      )}
    </span>
  );
}

/** The prototype's texts; another online server is named by its variable. */
function badgeTexts(server: ServerKind): { label: string; short: string; title: string } {
  if (server.kind === "local") return { label: "Local", short: "Local", title: "Local server: changes are saved in a file on this computer (development and the demo)." };
  if (server.name === "dev") {
    return {
      label: "Online · dev",
      short: "dev",
      title: "Online, development server: changes are saved in the database infomapper-dev, for everyone in this workspace. Not production.",
    };
  }
  if (server.name) return { label: `Online · ${server.name}`, short: server.name, title: `Online server ${server.name}: changes are saved in its database, for everyone in this workspace.` };
  return { label: "Online", short: "Online", title: "Online server: changes are saved in its database, for everyone in this workspace." };
}

export function ServerBadge({ server }: { server: ServerKind }) {
  const t = badgeTexts(server);
  return (
    <span
      data-testid="badge-server"
      data-server={server.kind}
      title={t.title}
      className="inline-flex h-[22px] flex-none cursor-default items-center gap-1.5 whitespace-nowrap rounded-[11px] border border-im-line px-2 text-[11.5px] text-im-ink-2"
    >
      <i className={cn("inline-block size-[7px] rounded-full", server.kind === "online" ? "bg-im-physical" : "bg-im-ink-3")} />
      <span className="max-[1501px]:hidden">{t.label}</span>
      <span className="hidden max-[1501px]:inline">{t.short}</span>
    </span>
  );
}

/** The pair, in the prototype's order: the indicator, then the badge. */
export function SavePair({ server }: { server: ServerKind }) {
  return (
    <div data-testid="group-save" className="flex flex-none items-center gap-2">
      <SaveIndicator />
      <ServerBadge server={server} />
    </div>
  );
}
