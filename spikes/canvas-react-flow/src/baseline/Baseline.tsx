"use client";

import { useEffect, useRef } from "react";
import { BODY_PAD, HEAD_H, ROW_H, cardHeight, getData } from "@/data/generate";
import FpsMeter from "@/canvas/FpsMeter";

/*
 * Comparison only (REPORT.md, C-01): the same cards and lines without React Flow, built the way the prototype does it:
 * cards as absolutely positioned divs, all lines in ONE svg, the world panned/zoomed with a CSS transform.
 * No interaction beyond wheel pan / Ctrl+wheel zoom. Same CSS classes as the spike, so paint work is comparable.
 */
export default function Baseline() {
  const data = getData();
  const world = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 40, y: 60, zoom: 0.11 });

  useEffect(() => {
    const el = world.current!;
    const stage = el.parentElement!;
    const apply = () => {
      const v = view.current;
      el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    };
    apply();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      if (e.ctrlKey) {
        const r = stage.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const z = Math.min(3, Math.max(0.1, v.zoom * Math.pow(2, -e.deltaY * 0.01)));
        v.x = px - ((px - v.x) * z) / v.zoom;
        v.y = py - ((py - v.y) * z) / v.zoom;
        v.zoom = z;
      } else {
        v.x -= e.deltaX * 0.5;
        v.y -= e.deltaY * 0.5;
      }
      apply();
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    (window as unknown as { __baseline: unknown }).__baseline = {
      set: (x: number, y: number, zoom: number) => { view.current = { x, y, zoom }; apply(); },
    };
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // line geometry from the data (all rows visible, so row y is index-based, as in the prototype)
  const byId = new Map(data.cards.map(c => [c.id, c]));
  const rowY = (cardId: string, rowId: string) => {
    const c = byId.get(cardId)!;
    const i = c.rows.findIndex(r => r.id === rowId);
    return c.y + HEAD_H + BODY_PAD + i * ROW_H + ROW_H / 2;
  };
  const paths = data.mappings.map(m => {
    const a = byId.get(m.srcCard)!, b = byId.get(m.entCard)!;
    const ltr = a.x + a.w / 2 <= b.x + b.w / 2, sn = ltr ? 1 : -1;
    const x0 = ltr ? a.x + a.w : a.x, y0 = rowY(a.id, m.column);
    const x3 = ltr ? b.x : b.x + b.w, y3 = rowY(b.id, m.attribute);
    const k = Math.max(60, Math.abs(x3 - x0) * 0.45);
    return `M${x0},${y0} C${x0 + sn * k},${y0} ${x3 - sn * k},${y3} ${x3},${y3}`;
  });
  const rels = data.relationships.map(r => {
    const a = byId.get(r.from)!, b = byId.get(r.to)!;
    const x0 = a.x + a.w, y0 = a.y + HEAD_H / 2, x3 = b.x, y3 = b.y + HEAD_H / 2;
    return `M${x0},${y0} C${x0 + 80},${y0} ${x3 - 80},${y3} ${x3},${y3}`;
  });

  return (
    <div className="shell">
      <header className="bar"><b>Baseline</b><span>plain DOM + one SVG, no React Flow (comparison for C-01)</span></header>
      <main className="stage" style={{ overflow: "hidden", background: "var(--canvas)" }}>
        <div ref={world} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0" }}>
          {data.frames.map(f => (
            <div key={f.id} className="frame" style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.h, ["--fc" as string]: f.color }} />
          ))}
          <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
            {rels.map((d, i) => <g key={"r" + i} className="lnk rel"><path className="s" d={d} /></g>)}
            {paths.map((d, i) => <g key={i} className="lnk map"><path className="hit" d={d} /><path className="s" d={d} /></g>)}
          </svg>
          {data.cards.map(c => (
            <div key={c.id} className={`card ${c.kind}`} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: cardHeight(c.rows.length), ["--cc" as string]: c.color }}>
              <div className="c-head">
                <div className="c-l1"><span className="stereo">{c.kind === "src" ? "Source" : "Entity"}</span><span>{c.sub}</span></div>
                <div className="c-l2"><span className="c-name">{c.name}</span><span className="cov-t">{c.rows.length}</span></div>
              </div>
              <div className="c-body">
                {c.rows.map(r => (
                  <div className="row" key={r.id}>
                    <span className="hnd l" />
                    <span className="key">{r.pk ? <b className="pk">PK</b> : r.fk ? <b>FK</b> : null}</span>
                    <span className="nm">{r.name}</span>
                    <span className="dt">{r.dataType}</span>
                    <span className="hnd r" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FpsMeter />
      </main>
    </div>
  );
}
