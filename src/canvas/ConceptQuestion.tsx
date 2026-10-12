"use client";

// The drop's question (slice 2b, D-05, D-17; prototype #ask): a bar at the top of the canvas, asked when entities
// land in a concept frame of another concept by a drag. The first button moves them in the model, the second keeps
// their concepts (the frame marks them as misplaced). Esc answers “keep”. Slice 3b asks a live canvas's questions in
// the same bar (prototype showAsk: “Label {name} with {label}?”, “Take the label {label} off {name}?”), with their own
// test ids; Esc answers “Cancel”.

import { useEffect, useRef } from "react";

/** A question in the bar: the text and its two answers. */
export interface CanvasQuestion {
  message: string;
  yes: string;
  no: string;
}

/** Test ids of the bar and its buttons: the drop's question by default, a live canvas's with `live`. */
const IDS = {
  concept: { dialog: "dialog-concept-question", text: "text-concept-question", yes: "button-concept-move", no: "button-concept-keep" },
  live: { dialog: "dialog-live-question", text: "text-live-question", yes: "button-live-yes", no: "button-live-no" },
} as const;

export function ConceptQuestion({ question, onAnswer, kind = "concept" }: { question: CanvasQuestion; onAnswer: (yes: boolean) => void; kind?: keyof typeof IDS }) {
  const yes = useRef<HTMLButtonElement>(null);
  const ids = IDS[kind];
  useEffect(() => {
    yes.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onAnswer(false);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onAnswer]);
  return (
    <div className="concept-ask" role="alertdialog" aria-live="polite" data-testid={ids.dialog}>
      <span data-testid={ids.text}>{question.message}</span>
      <button ref={yes} type="button" className="ask-yes" onClick={() => onAnswer(true)} data-testid={ids.yes}>
        {question.yes}
      </button>
      <button type="button" className="ask-no" onClick={() => onAnswer(false)} data-testid={ids.no}>
        {question.no}
      </button>
    </div>
  );
}
