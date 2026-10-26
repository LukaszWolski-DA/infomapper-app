// The project home's “Model consistency” (slice 7b, item 25; prototype `consistencyHtml`): between the stats and the
// canvases, with a count badge; each group with its severity, count and hint; each line a link that opens its object on
// the canvas `modelConsistency` chose (F15: `?map=`, `?row=`, `?system=`, and `?req=` as the Requirements list). A
// server component: the page computes it on every load, so it is live after any action.

import Link from "next/link";
import { CONSISTENCY_TEXT, type Consistency, type ConsistencyLine } from "@/domain/source-changes/consistency";

const lineClass = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-im-hover";
const groupClass = "mb-2 rounded-lg border border-im-line bg-im-surface px-2.5 py-2";

const Line = ({ line, href }: { line: ConsistencyLine; href: string }) => (
  <Link href={href} className={lineClass} data-testid="consistency-line" data-open={`${line.open.t}:${line.open.id}`}>
    <span className="min-w-0 flex-1 truncate font-mono text-xs">{line.name}</span>
    <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{line.meta}</span>
  </Link>
);

const Tag = ({ high }: { high: boolean }) => (
  <span className={`rounded px-1.5 text-[11px] font-medium ${high ? "bg-im-warn text-im-surface" : "bg-im-hover text-im-ink-2"}`}>{high ? "High" : "Normal"}</span>
);

export function ProjectConsistency({ consistency: c, href }: { consistency: Consistency; href: (canvasId: string, query: string) => string }) {
  const ok = c.count === 0 && c.requirements.length === 0;
  const lineHref = (l: ConsistencyLine) => href(l.canvasId, `${l.open.t}=${l.open.id}`);
  return (
    <section className="mt-6 max-w-[900px]" data-testid="section-consistency">
      <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-im-ink-2">
        {CONSISTENCY_TEXT.title}
        {!ok && (
          <span className="rounded-full bg-im-warn px-1.5 text-[11px] font-semibold text-im-surface" data-testid="consistency-badge">
            {c.count}
          </span>
        )}
      </h3>
      {ok && (
        <p className="text-im-ink-3" data-testid="text-consistency-ok">
          {CONSISTENCY_TEXT.allWell}
        </p>
      )}
      {c.groups.map((g) => (
        <div key={g.id} className={`${groupClass} ${g.severity === "high" ? "border-l-[3px] border-l-im-warn" : ""}`} data-testid="consistency-group" data-group={g.id} data-severity={g.severity}>
          <div className="mb-1 flex items-center gap-2">
            <Tag high={g.severity === "high"} />
            <b className="font-semibold" data-testid="consistency-title">
              {g.title}
            </b>
            <span className="text-im-ink-3">{g.lines.length}</span>
          </div>
          {g.hint && (
            <p className="mb-1.5 mt-0.5 text-xs text-im-ink-3" data-testid="consistency-hint">
              {g.hint}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {g.lines.map((l) => (
              <Line key={l.open.id} line={l} href={lineHref(l)} />
            ))}
          </div>
        </div>
      ))}
      {c.requirements.length > 0 && (
        <div className={groupClass} data-testid="consistency-group" data-group="requirements">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-im-req-soft px-1.5 text-[11px] font-medium text-im-req-ink">Requirements</span>
            <b className="font-semibold" data-testid="consistency-title">
              {CONSISTENCY_TEXT.requirements}
            </b>
            <span className="text-im-ink-3">{c.requirements.length}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {c.requirements.map((r) => (
              <Link key={r.id} href={href(r.bestCanvasId ?? "", `req=${r.id}`)} className={lineClass} data-testid="consistency-line" data-open={`req:${r.id}`}>
                <span className="font-mono text-[11.5px] text-im-req">{r.key}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">
                  {r.covered}/{r.total} covered
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {c.systems.length > 0 && (
        <div className={groupClass} data-testid="consistency-group" data-group="systems">
          <div className="mb-1 flex items-center gap-2">
            <b className="font-semibold" data-testid="consistency-title">
              {CONSISTENCY_TEXT.systems}
            </b>
          </div>
          <div className="flex flex-col gap-0.5">
            {c.systems.map((l) => (
              <Line key={l.open.id} line={l} href={lineHref(l)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
