// Small pieces shared by the left panel's Requirements tab and the panels (slice 4a): the kind icons (prototype RICON),
// the requirements' diamond dot and the coverage bar (“{ok} of {total} covered”, its tooltip naming the parts, e.g.
// “1 entity, 3 attributes”; slice 4b-1, PRD item 11).

import type { RequirementKind } from "@/domain/types";

const PATHS: Record<RequirementKind, React.ReactNode> = {
  need: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  data: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  ),
  business_rule: <path d="M8 2.5v11M4 13.5h8M2.5 5.5h11M4.5 5.5L2.5 10h4zM11.5 5.5L9.5 10h4z" />,
  dq_rule: (
    <>
      <path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" />
      <path d="M5.8 8.2l1.6 1.6 3-3.2" />
    </>
  ),
  non_functional: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </>
  ),
};

export const KindIcon = ({ kind }: { kind: RequirementKind }) => (
  <svg viewBox="0 0 16 16" className="size-3 flex-none fill-none stroke-current stroke-[1.5]" aria-hidden data-kind={kind}>
    {PATHS[kind]}
  </svg>
);

/** The requirements' diamond (prototype .rdot). */
export const ReqDot = () => <i className="size-[7px] flex-none rotate-45 rounded-[1px] bg-im-req" aria-hidden />;

export const coverageText = (ok: number, total: number) => `${ok} of ${total} covered`;
/** The text and, in brackets, the parts (“1 of 4 covered (1 entity, 3 attributes)”); no parts without items. */
export const coverageTitle = (ok: number, total: number, parts?: string) => (parts && total ? `${coverageText(ok, total)} (${parts})` : coverageText(ok, total));

export function CoverageBar({ ok, total, parts, testId }: { ok: number; total: number; parts?: string; testId?: string }) {
  return (
    <span
      className="relative h-1 w-9 flex-none overflow-hidden rounded-full bg-im-line"
      title={coverageTitle(ok, total, parts)}
      data-testid={testId}
      data-covered={ok}
      data-total={total}
    >
      <i className="absolute inset-y-0 left-0 bg-im-req" style={{ width: `${total ? (ok / total) * 100 : 0}%` }} />
    </span>
  );
}
