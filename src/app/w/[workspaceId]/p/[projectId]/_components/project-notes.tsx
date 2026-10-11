// “Open notes” on the project home (slice 3a, item 12; prototype renderHome): the open notes on the project's canvases,
// each by its first line (or “Empty note”) with its canvas's name and, when pinned, what it is on; a click opens that
// canvas with the note selected (`?note=`).

import Link from "next/link";
import type { ProjectNote } from "@/app/_panels/stats";
import { firstLine } from "@/canvas/note-data";

const NoteIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="size-[13px] flex-none fill-none stroke-current [stroke-linejoin:round] [stroke-width:1.5]">
    <path d="M3 2.5h10v7.5l-3.5 3.5H3z" />
    <path d="M13 10H9.5v3.5" />
  </svg>
);

export function ProjectNotes({ notes }: { notes: (ProjectNote & { href: string })[] }) {
  if (!notes.length) return <p className="text-im-ink-3" data-testid="text-no-open-notes">No open notes on this project’s canvases.</p>;
  return (
    <div className="flex flex-col gap-0.5" data-testid="list-project-notes">
      {notes.map((n) => (
        <Link key={n.id} href={n.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-im-hover" data-testid="item-project-note" data-note={n.id}>
          <span className="text-im-ink-3">
            <NoteIcon />
          </span>
          <span className="min-w-0 flex-1 truncate">{firstLine(n.text) || "Empty note"}</span>
          <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">
            {n.canvasName}
            {n.pinName ? `, on ${n.pinName}` : ""}
          </span>
        </Link>
      ))}
    </div>
  );
}
