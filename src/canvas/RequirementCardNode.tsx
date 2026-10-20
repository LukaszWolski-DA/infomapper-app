"use client";

// A requirement's card on the canvas (slice 4b-2, D-41; prototype renderReqCards, .rq-card): a filled violet header
// with the kind's icon, the key and the kind's name; the name; a three-part coverage bar; the status pill and
// “{m} of {n} covered”. Below 40 % zoom the header and a plain block of the same height (AD-24 rule 1). 230 px wide, its
// height from its name's lines (`requirementCardHeight`), the same at every zoom. Selecting it is selecting the
// requirement; the selection mark is drawn in the overlay (`SelectionOverlay`), so selecting restyles no card.
// AD-24 rule 4: the icon is a CSS mask and the bar one element with a gradient (canvas.css); no opacity, no transform,
// no `overflow: hidden`.

import { memo, useContext } from "react";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import { CanvasCardsCtx, DiagnosisCtx } from "./context";
import { LOD_ZOOM } from "./geometry";
import { barTitle, coverageText, REQ_CARD, requirementCardHeight, type RequirementCardData } from "./requirement-card-data";

export type ReqNodeT = Node<{ card: RequirementCardData }, "req">;

/** A requirement card's node (slice 4b-2): React Flow holds it beside the entity and table cards and the blocks. */
export const isReqNode = (n: Node): n is ReqNodeT => n.type === "req";
/** The requirement card nodes React Flow holds now. */
export const reqNodesOf = (rf: { getNodes: () => Node[] }): ReqNodeT[] => rf.getNodes().filter(isReqNode);

/** The bar's three parts as one gradient's stops, in %: covered, then mapped but not approved, then not mapped. */
export function barStops(bar: RequirementCardData["bar"], total: number): [number, number] {
  if (!total) return [0, 0];
  const a = (bar.covered / total) * 100;
  return [+a.toFixed(2), +(a + (bar.mapped / total) * 100).toFixed(2)];
}

function RequirementCardNode({ data }: NodeProps<ReqNodeT>) {
  const { card } = data;
  const ctx = useContext(CanvasCardsCtx);
  const blocks = !!useContext(DiagnosisCtx).blocks;
  const lod = useStore((s) => blocks || s.transform[2] < LOD_ZOOM);
  const h = requirementCardHeight(card.nameLines);
  const [a, b] = barStops(card.bar, card.total);

  // a click selects the requirement (its panel and coverage colours); Shift+click puts the card in or out of a
  // selection of several (L)
  const onClick = (e: React.MouseEvent) => {
    if (e.shiftKey) ctx.toggleCard(card.id);
    else ctx.select({ t: "req", id: card.requirementId });
  };

  return (
    <div
      onClick={onClick}
      className="rq-card"
      title={card.title || undefined}
      style={{ height: h }}
      data-testid="card-requirement"
      data-card={card.id}
      data-requirement={card.requirementId}
      data-key={card.key}
    >
      <div className="rh">
        <i className={`ric ${card.kind}`} />
        <span className="k">{card.key}</span>
        <span className="kind">{card.kindName}</span>
      </div>
      {lod ? (
        <div className="c-lod" data-testid="card-block" style={{ height: h - REQ_CARD.headH }}>
          <div className="c-block" />
        </div>
      ) : (
        <>
          <div className="rn" data-testid="card-name">
            {card.name}
          </div>
          <div
            className="tri"
            title={barTitle(card)}
            data-testid="bar-requirement"
            data-covered={card.bar.covered}
            data-mapped={card.bar.mapped}
            data-not-mapped={card.bar.notMapped}
            style={{ "--a": `${a}%`, "--b": `${b}%` } as React.CSSProperties}
          />
          <div className="rf">
            <span className="st-pill" data-testid="pill-status">
              {card.statusName}
            </span>
            <span data-testid="text-requirement-coverage">{coverageText(card)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(RequirementCardNode);
