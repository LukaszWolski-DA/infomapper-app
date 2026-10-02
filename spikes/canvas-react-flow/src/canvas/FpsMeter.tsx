"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Small on-screen FPS readout (brief item 9).
 * Measures requestAnimationFrame intervals, so it reflects frames the browser actually produced.
 *
 * Also exposes window.__perf for scripted measurements:
 *   __perf.start()  → begin a recording
 *   __perf.stop()   → { frames, durationMs, avgFps, maxFrameMs, p95FrameMs, over50ms }
 */

export interface PerfResult {
  frames: number;
  durationMs: number;
  avgFps: number;
  maxFrameMs: number;
  p95FrameMs: number;
  over50ms: number;
}

declare global {
  interface Window {
    __perf?: { start: () => void; stop: () => PerfResult };
  }
}

export default function FpsMeter() {
  const [view, setView] = useState({ fps: 0, worst: 0 });
  const rec = useRef<number[] | null>(null);
  const recStart = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let winStart = last, winFrames = 0, winWorst = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      winFrames++;
      winWorst = Math.max(winWorst, dt);
      rec.current?.push(dt);
      if (now - winStart >= 500) {
        setView({ fps: Math.round((winFrames * 1000) / (now - winStart)), worst: Math.round(winWorst) });
        winStart = now; winFrames = 0; winWorst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.__perf = {
      start() {
        rec.current = [];
        recStart.current = performance.now();
      },
      stop() {
        const dts = rec.current ?? [];
        rec.current = null;
        const durationMs = performance.now() - recStart.current;
        const sorted = [...dts].sort((a, b) => a - b);
        return {
          frames: dts.length,
          durationMs: Math.round(durationMs),
          avgFps: +((dts.length * 1000) / durationMs).toFixed(1),
          maxFrameMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
          p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
          over50ms: dts.filter(d => d > 50).length,
        };
      },
    };
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone = view.fps >= 50 ? "ok" : view.fps >= 30 ? "mid" : "bad";
  return (
    <div className={`fps fps-${tone}`} data-testid="fps">
      <b>{view.fps}</b> fps <span>· worst {view.worst} ms</span>
    </div>
  );
}
