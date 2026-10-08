// What the canvas draws for its frames (slice 2b), as plain serialisable data built on the server, and the label's
// numbers (prototype frameStats, renderFrames): how far the frame's cards are mapped and what does not belong there.
// Membership is read from the cards as the canvas has them now, so the label follows a drop before a fresh page.

import type { Uuid } from "@/domain/ids";
import { FREE_FRAME_COLORS, isMisplaced } from "@/domain/model/frames";
import type { Frame, FrameKind, WorkspaceModel } from "@/domain/types";
import type { CardData } from "./card-data";

export interface FrameData {
  id: Uuid;
  version: number;
  name: string;
  kind: FrameKind;
  conceptId: Uuid | null;
  sourceSystemId: Uuid | null;
  /** The free colour as stored (null for a concept or source frame). */
  color: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The colour a frame is drawn in: its concept's, the physical colour for a source frame, or its own (prototype frameColor). */
export function frameColor(frame: Pick<FrameData, "kind" | "conceptId" | "color">, conceptColor: (id: Uuid) => string | undefined): string {
  if (frame.kind === "concept") return (frame.conceptId && conceptColor(frame.conceptId)) || FREE_FRAME_COLORS[0];
  if (frame.kind === "source_system") return "var(--im-physical)";
  return frame.color ?? FREE_FRAME_COLORS[0];
}

/** The frames of one canvas, smallest last, so a smaller frame lying on a bigger one is drawn above it. */
export function buildFrames(frames: readonly Frame[]): FrameData[] {
  return frames
    .map((f) => ({
      id: f.id,
      version: f.version,
      name: f.name,
      kind: f.kind,
      conceptId: f.concept_id,
      sourceSystemId: f.source_system_id,
      color: f.color,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    }))
    .sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id));
}

/** Concept colours by id, for `frameColor`. */
export const conceptColors = (model: Pick<WorkspaceModel, "concepts">): Record<Uuid, string> => Object.fromEntries(model.concepts.map((c) => [c.id, c.color]));

export interface FrameStats {
  /** Cards in the frame. */
  cards: number;
  attributes: number;
  mapped: number;
  columns: number;
  used: number;
  /** Mappings of its cards with a type problem, each counted once. */
  typeProblems: number;
  drafts: number;
  misplaced: number;
}

type StatCard = Pick<CardData, "id" | "kind" | "rows" | "mapped" | "frameId" | "subject" | "links">;

/** The frame's cards on this canvas. */
export const membersOf = <C extends Pick<CardData, "frameId">>(frameId: Uuid, cards: readonly C[]): C[] => cards.filter((c) => c.frameId === frameId);

/** The numbers of the frame's label and panel (prototype frameStats). */
export function frameStats(frame: Pick<FrameData, "id" | "kind" | "conceptId" | "sourceSystemId">, cards: readonly StatCard[]): FrameStats {
  const members = membersOf(frame.id, cards);
  const links = new Map(members.flatMap((c) => c.links).map((l) => [l.id, l]));
  const ents = members.filter((c) => c.kind === "ent"), srcs = members.filter((c) => c.kind === "src");
  const asFrame = { kind: frame.kind, concept_id: frame.conceptId, source_system_id: frame.sourceSystemId };
  return {
    cards: members.length,
    attributes: ents.reduce((n, c) => n + c.rows.length, 0),
    mapped: ents.reduce((n, c) => n + c.mapped, 0),
    columns: srcs.reduce((n, c) => n + c.rows.length, 0),
    used: srcs.reduce((n, c) => n + c.mapped, 0),
    typeProblems: [...links.values()].filter((l) => l.warn).length,
    drafts: [...links.values()].filter((l) => l.draft).length,
    misplaced: members.filter((c) => isMisplaced(asFrame, c.subject)).length,
  };
}

export interface FrameChip {
  text: string;
  title: string;
  tone?: "warn" | "misplaced";
}

/** The label's chips, as in the prototype: only those with something to say. */
export function frameChips(stats: FrameStats, kind: FrameKind): FrameChip[] {
  const chips: FrameChip[] = [];
  if (stats.attributes) chips.push({ text: `${stats.mapped}/${stats.attributes} mapped`, title: "Attributes mapped" });
  if (stats.columns) chips.push({ text: `${stats.used}/${stats.columns} used`, title: "Columns used by mappings" });
  if (stats.typeProblems) chips.push({ text: `${stats.typeProblems} type`, title: "Mappings whose data types don't fit", tone: "warn" });
  if (stats.drafts) chips.push({ text: `${stats.drafts} draft${stats.drafts > 1 ? "s" : ""}`, title: "Draft mappings" });
  if (stats.misplaced) {
    chips.push({
      text: `${stats.misplaced} misplaced`,
      title: kind === "concept" ? "Cards that are not entities of this concept" : "Cards that are not tables of this system",
      tone: "misplaced",
    });
  }
  return chips;
}
