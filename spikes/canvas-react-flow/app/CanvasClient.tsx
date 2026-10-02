"use client";

import dynamic from "next/dynamic";

// The canvas is client-only: it measures the DOM and owns the viewport. See REPORT.md (C-12) for the SSR notes.
const Canvas = dynamic(() => import("@/canvas/Canvas"), { ssr: false });

export default function CanvasClient() {
  return <Canvas />;
}
