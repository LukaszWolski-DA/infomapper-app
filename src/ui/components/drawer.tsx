"use client";

// The drawer (slice 39, S39-04; the prototype's layout B, `.pf-drawer`): a panel from the right, 560 px (the screen's
// width on a phone), under the platform's 48 px bar. Not modal on a wide screen: from 1,100 px the page keeps the room
// (`DRAWER_ROOM` on its column) and stays clickable; narrower, a light scrim covers the page and a click on it closes
// the drawer. The page owns what is open and its keys (Esc); the drawer draws, and is mounted only while open.

import * as React from "react"
import { cn } from "@/ui/lib/utils"

export const DRAWER_WIDTH = 560

/**
 * The room a page's centred column gives the open drawer from 1,100 px (the prototype's rule): it moves left, at most
 * to the page's edge, and keeps clear of the drawer. Layout classes for the column's own element (a stretched flex item:
 * its width follows the margins).
 */
export const DRAWER_ROOM = "min-[1100px]:w-auto min-[1100px]:mr-[560px] min-[1100px]:ml-[max(0px,calc((100%_-_1660px)/2))]"

/** A section's heading inside the drawer: small capitals, the third ink. */
export const DRAWER_HEADING = "m-0 mb-1.5 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[.05em] text-im-ink-3"

/** A connected item: a full-width row with its name and a short note at the right end (the prototype's `.pf-rel`). */
export const DRAWER_LINK =
  "flex min-h-target w-full min-w-0 items-center justify-between gap-2 rounded-[6px] border border-im-line bg-im-surface px-[9px] py-1.5 text-left text-body text-im-ink hover:bg-im-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-im-logical"

/** A link inside a characteristic's value (the prototype's `.pf-kv dd button`). */
export const DRAWER_INLINE_LINK =
  "inline-flex min-h-target max-w-full items-center rounded-[5px] border border-im-line bg-im-surface px-[7px] py-0.5 text-left text-im-ink [overflow-wrap:anywhere] hover:bg-im-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-im-logical"

export function Drawer({
  label,
  onClose,
  testId,
  className,
  children,
}: {
  /** Its accessible name ("Details"). */
  label: string
  /** A click on the scrim (below 1,100 px). */
  onClose: () => void
  testId?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <>
      <div
        aria-hidden="true"
        data-testid={testId ? `${testId}-scrim` : undefined}
        onClick={onClose}
        className="fixed inset-x-0 bottom-0 top-12 z-[5] bg-[rgba(16,20,26,.16)] min-[1100px]:hidden"
      />
      <aside
        aria-label={label}
        data-testid={testId}
        className={cn(
          "fixed bottom-0 right-0 top-12 z-[6] w-[min(560px,100vw)] overflow-auto border-l border-im-line bg-im-surface px-[30px] pb-10 pt-4 shadow-[-18px_0_48px_var(--im-shadow)] animate-in slide-in-from-right duration-200 max-[601px]:px-4",
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}
