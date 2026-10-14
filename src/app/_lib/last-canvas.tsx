"use client";

// The canvas a person opened last in each project (slice 4a, PRD item 30): a browser preference written when a canvas
// page opens, read by the project home's requirements (a click opens that canvas, else the project's first).

import { useEffect } from "react";
import { writePreference } from "@/canvas/CanvasProvider";

export const lastCanvasKey = (projectId: string) => `infomapper:last-canvas:${projectId}`;

/** Remembers this canvas as the project's last opened one. Renders nothing. */
export function RememberLastCanvas({ projectId, canvasId }: { projectId: string; canvasId: string }) {
  useEffect(() => writePreference(lastCanvasKey(projectId), canvasId), [projectId, canvasId]);
  return null;
}
