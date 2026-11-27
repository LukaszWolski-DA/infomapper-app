"use client";

// The project home's Requirements (slice 4a, PRD item 30, prototype renderHome): every requirement whose scope touches
// the project's canvases, with key, name, kind, coverage bar and “{ok}/{total}, {status}”. A click opens the canvas that
// shows most of it (slice 4b-2, PRD item 23; `bestCanvasId`), else the project's last opened canvas (else its first), with
// the requirement selected and its panel open.

import { useRouter } from "next/navigation";
import { lastCanvasKey } from "@/app/_lib/last-canvas";
import { CoverageBar, KindIcon } from "@/app/_panels/requirement-ui";
import type { ProjectRequirement } from "@/app/_panels/stats";
import { readPreference } from "@/canvas/CanvasProvider";
import { STATUS_NAMES } from "@/domain/model/requirements";

export function ProjectRequirements({ projectId, requirements, canvases }: { projectId: string; requirements: ProjectRequirement[]; canvases: { id: string; href: string }[] }) {
  const router = useRouter();
  if (!requirements.length) {
    return (
      <p className="text-im-ink-3" data-testid="text-project-requirements-empty">
        No requirement touches this project&apos;s canvases yet.
      </p>
    );
  }
  const open = (r: ProjectRequirement) => {
    const last = readPreference(lastCanvasKey(projectId));
    const canvas = canvases.find((c) => c.id === r.bestCanvasId) ?? canvases.find((c) => c.id === last) ?? canvases[0];
    if (canvas) router.push(`${canvas.href}?req=${r.id}`);
  };
  return (
    // slice 38 (S38-03): in the project home's right column, its width; the kind's icon stays, its name goes, the name wraps
    <div className="flex flex-col gap-0.5" data-testid="list-project-requirements">
      {requirements.map((r) => (
        <button
          key={r.id}
          type="button"
          className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover"
          title="Open it on a canvas of this project"
          onClick={() => open(r)}
          data-testid="item-project-requirement"
          data-key={r.key}
        >
          <span className="flex flex-none items-center gap-1 text-im-req">
            <KindIcon kind={r.kind} />
            <span className="font-mono text-[11.5px]">{r.key}</span>
          </span>
          <span className="min-w-0 flex-1 break-words">{r.name}</span>
          <CoverageBar ok={r.covered} total={r.total} parts={r.parts} />
          <span className="whitespace-nowrap text-[11.5px] text-im-ink-3" data-testid="text-project-requirement-coverage">
            {r.covered}/{r.total}, {STATUS_NAMES[r.status]}
          </span>
        </button>
      ))}
    </div>
  );
}
