import "server-only";
import type { LiveOutcome } from "@/domain/commands/live";

// What a person's writes changed on live canvases (slice 3b, PRD item 7 and Q7): the open live canvas shows it as a toast
// (“Added from {label}: …. No longer labeled: ….”) when its fresh page arrives; other live canvases change silently.
// Kept in the server's memory for a minute, like the undo history (one development server, AD-29); a page opened later
// shows nothing (the canvas takes only notices newer than the ones it found when it opened).

export interface LiveNotice {
  id: number;
  added: string[];
  removed: string[];
}

interface Stored extends LiveNotice {
  userId: string;
  canvasId: string;
  at: number;
}

const KEEP_MS = 60_000;
const store = globalThis as unknown as { __imLiveNotices?: { next: number; list: Stored[] } };
const notices = () => (store.__imLiveNotices ??= { next: 1, list: [] });

export function recordLiveNotices(userId: string, outcome: LiveOutcome): void {
  const n = notices();
  const now = Date.now();
  n.list = n.list.filter((s) => now - s.at < KEEP_MS);
  for (const c of outcome.canvases) n.list.push({ id: n.next++, userId, canvasId: c.canvasId, added: c.added, removed: c.removed, at: now });
}

export function liveNoticesFor(userId: string, canvasId: string): LiveNotice[] {
  const now = Date.now();
  return notices()
    .list.filter((s) => s.userId === userId && s.canvasId === canvasId && now - s.at < KEEP_MS)
    .map(({ id, added, removed }) => ({ id, added, removed }));
}
