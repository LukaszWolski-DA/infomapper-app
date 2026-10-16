"use client";

// The project home's Requirements (slice 4a, PRD item 30, prototype renderHome): every requirement whose scope touches
// the project's canvases, with key, name, kind, coverage bar and “{ok}/{total}, {status}”. A click opens the project's
// last opened canvas (else its first) with the requirement's panel open.

import { useRouter } from "next/navigation";
import { lastCanvasKey } from "@/app/_lib/last-canvas";
import { CoverageBar, KindIcon } from "@/app/_panels/requirement-ui";
import type { ProjectRequirement } from "@/app/_panels/stats";
import { readPreference } from "@/canvas/CanvasProvider";
import { KIND_NAMES, STATUS_NAMES } from "@/domain/model/requirements";

export function ProjectRequirements({ projectId, requirements, canvases }: { projectId: string; requirements: ProjectRequirement[]; canvases: { id: string; href: string }[] }) {
  const router = useRouter();
  if (!requirements.length) {
    return (
      <p className="text-im-ink-3" data-testid="text-project-requirements-empty">
        No requirement touches this project&apos;s canvases yet.
      </p>
    );
  }
  const open = (id: string) => {
    const last = readPreference(lastCanvasKey(projectId));
    const canvas = canvases.find((c) => c.id === last) ?? canvases[0];
    if (canvas) router.push(`${canvas.href}?req=${id}`);
  };
  return (
    <div className="flex max-w-[620px] flex-col gap-0.5" data-testid="list-project-requirements">
      {requirements.map((r) => (
        <button
          key={r.id}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover"
          title="Open it on a canvas of this project"
          onClick={() => open(r.id)}
          data-testid="item-project-requirement"
          data-key={r.key}
        >
          <span className="flex flex-none items-center gap-1 text-im-req">
            <KindIcon kind={r.kind} />
            <span className="font-mono text-[11.5px]">{r.key}</span>
          </span>
          <span className="min-w-0 flex-1 truncate">{r.name}</span>
          <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{KIND_NAMES[r.kind]}</span>
          <CoverageBar ok={r.covered} total={r.total} parts={r.parts} />
          <span className="whitespace-nowrap text-[11.5px] text-im-ink-3" data-testid="text-project-requirement-coverage">
            {r.covered}/{r.total}, {STATUS_NAMES[r.status]}
          </span>
        </button>
      ))}
    </div>
  );
}
