"use client";

// The drop's question (slice 2b, D-05, D-17; prototype #ask): a bar at the top of the canvas, asked when entities
// land in a concept frame of another concept by a drag. The first button moves them in the model, the second keeps
// their concepts (the frame marks them as misplaced). Esc answers “keep”.

import { useEffect, useRef } from "react";
import type { ConceptAsk } from "./frame-data";

export function ConceptQuestion({ question, onAnswer }: { question: ConceptAsk; onAnswer: (move: boolean) => void }) {
  const yes = useRef<HTMLButtonElement>(null);
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
    <div className="concept-ask" role="alertdialog" aria-live="polite" data-testid="dialog-concept-question">
      <span data-testid="text-concept-question">{question.message}</span>
      <button ref={yes} type="button" className="ask-yes" onClick={() => onAnswer(true)} data-testid="button-concept-move">
        {question.yes}
      </button>
      <button type="button" className="ask-no" onClick={() => onAnswer(false)} data-testid="button-concept-keep">
        {question.no}
      </button>
    </div>
  );
}
