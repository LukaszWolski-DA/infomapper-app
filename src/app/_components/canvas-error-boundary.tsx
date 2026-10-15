"use client";

// The canvas's error boundary (slice 4p, item 8): an error inside the canvas shows a message in its place, while the top
// bar, the tabs, the left panel, the inspector and the status bar (outside it) keep working. “Reload” draws the canvas
// again from the server's data (Next.js `catchError`'s `retry`: re-fetch and re-render, the state outside kept). The
// error itself is not shown or logged here.

import { catchError, type ErrorInfo } from "next/error";
import { ErrorMessage, primaryButton } from "./error-message";

function CanvasError(_props: object, { retry }: ErrorInfo) {
  return (
    <ErrorMessage testId="panel-canvas-error" heading="Something went wrong on this canvas." text="The panels still work. Reload the canvas to try again; your saved work is not affected.">
      <button type="button" className={primaryButton} onClick={() => retry()} data-testid="button-canvas-reload">
        Reload
      </button>
    </ErrorMessage>
  );
}

export const CanvasErrorBoundary = catchError(CanvasError);
