"use client";

// The project home's "Model checks" (slice 20, PRD item 1, B1; prototype `checksHtml`): after Model consistency, with a
// count badge; the sentence; one box per group as consistency's (its severity, a module's tag, title, count, hint), High
// first; 20 lines per group, the rest read on "Show all {n}" (`projectChecksAction`, D-35) and folded again on "Show the
// first 20"; with nothing to show, the all-well text. Each line opens its object on the canvas the server chose.

import Link from "next/link";
import { useState } from "react";
import { projectChecksAction } from "@/app/_actions/checks";
import type { HomeCheckGroup, HomeChecks, HomeCheckLine } from "@/app/_lib/project-checks";
import { CHECK_TEXTS } from "@/domain/model/checks";
import { useToast } from "@/ui/components/toast";

const lineClass = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover";
const groupClass = "mb-2 rounded-lg border border-im-line bg-im-surface px-2.5 py-2";
const LIMIT = 20;

const Line = ({ line }: { line: HomeCheckLine }) => (
  <Link href={line.href} className={lineClass} data-testid="check-line" data-open={line.open}>
    <span className="min-w-0 flex-1 truncate font-mono text-xs">{line.name}</span>
    <span className="min-w-0 truncate text-[11.5px] text-im-ink-3">{line.detail}</span>
  </Link>
);

function Group({ group, workspaceId, projectId }: { group: HomeCheckGroup; workspaceId: string; projectId: string }) {
  const toast = useToast();
  const [all, setAll] = useState<HomeCheckLine[] | null>(null);
  const [shown, setShown] = useState(false);
  const lines = shown && all ? all : group.lines;
  const toggle = async () => {
    if (shown) return setShown(false);
    if (!all) {
      const result = await projectChecksAction(workspaceId, projectId, group.id);
      if (!result.ok) return toast(result.message, "refusal");
      setAll(result.value?.lines ?? group.lines);
    }
    setShown(true);
  };
  return (
    <div className={`${groupClass} ${group.high ? "border-l-[3px] border-l-im-warn" : ""}`} data-testid="check-group" data-group={group.id} data-severity={group.high ? "high" : "normal"}>
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded px-1.5 text-[11px] font-medium ${group.high ? "bg-im-warn text-im-surface" : "bg-im-hover text-im-ink-2"}`}>{group.high ? CHECK_TEXTS.high : CHECK_TEXTS.normal}</span>
        {group.module && <span className="rounded bg-im-hover px-1.5 text-[11px] font-medium text-im-ink-2" data-testid="check-module">{group.module}</span>}
        <b className="font-semibold" data-testid="check-title">
          {group.title}
        </b>
        <span className="text-im-ink-3">{group.count}</span>
      </div>
      <p className="mb-1.5 mt-0.5 text-xs text-im-ink-3" data-testid="check-hint">
        {group.hint}
      </p>
      <div className="flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <Line key={`${l.open}:${i}`} line={l} />
        ))}
      </div>
      {group.count > LIMIT && (
        <button type="button" className="mt-1 rounded-md border border-im-line px-2 py-0.5 text-xs hover:bg-im-hover" onClick={() => void toggle()} data-testid="button-checks-all">
          {shown ? CHECK_TEXTS.showFirst : CHECK_TEXTS.showAll(group.count)}
        </button>
      )}
    </div>
  );
}

export function ProjectChecks({ checks, workspaceId, projectId }: { checks: HomeChecks; workspaceId: string; projectId: string }) {
  return (
    <section className="mt-6 max-w-[900px] scroll-mt-4" id="model-checks" data-testid="section-checks">
      <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-im-ink-2">
        {CHECK_TEXTS.title}
        {checks.count > 0 && (
          <span className="rounded-full bg-im-warn px-1.5 text-[11px] font-semibold text-im-surface" data-testid="checks-badge">
            {checks.count}
          </span>
        )}
      </h3>
      <p className="mb-2 text-xs text-im-ink-3" data-testid="checks-intro">
        {CHECK_TEXTS.intro(checks.topics)}
      </p>
      {checks.count === 0 ? (
        <p className="text-im-ink-3" data-testid="text-checks-ok">
          {CHECK_TEXTS.allWell(checks.allWell)}
        </p>
      ) : (
        checks.groups.map((g) => <Group key={g.id} group={g} workspaceId={workspaceId} projectId={projectId} />)
      )}
    </section>
  );
}

/** The stats' link (PRD item 2): "! {n} model checks", orange with a High line; scrolls to the section. */
export function ChecksStat({ count, high }: { count: number; high: boolean }) {
  if (!count) return null;
  return (
    <button
      type="button"
      data-testid="stat-checks"
      data-high={high || undefined}
      title={CHECK_TEXTS.statTitle}
      onClick={() => document.getElementById("model-checks")?.scrollIntoView({ block: "start", behavior: "smooth" })}
      className={`inline-flex items-center gap-1 rounded-[14px] bg-im-surface px-[11px] py-[3px] text-xs shadow-[0_0_0_1px_var(--im-line)] hover:bg-im-hover hover:underline ${high ? "text-im-warn" : "text-im-ink-2"}`}
    >
      <span className={`w-2.5 -skew-x-12 text-center font-bold italic ${high ? "text-im-warn" : "text-im-ink-3"}`} aria-hidden>
        !
      </span>
      <b className="font-semibold">{count}</b> {CHECK_TEXTS.stat(count).replace(/^\d+ /, "")}
    </button>
  );
}
