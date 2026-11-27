// Slice 37 (S37-02, step 4): the top bar's tool button (`.im-btn.icon` at the bar's 30 px, `control-bar`): no edge, no
// fill until hovered, pressed in a tone (`logical` the accent's soft fill, `warn` the Changes view's, `plain` the ink
// only: a side panel's toggle). Its padding is the caller's breakpoints' (F15: every top-bar control keeps its width),
// so the look carries none; a label beside the icon is the caller's too. Slice 38: `size: "toolbar"`, the canvas
// toolbar's 28 px square icon button (the prototype's `#ctb .tb`, `control-sm`), padding and width its own.
import { cva } from "class-variance-authority"

export const toolButtonVariants = cva(
  "inline-flex flex-none items-center gap-1.5 rounded-md text-im-ink-2 outline-none hover:bg-im-hover hover:text-im-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-im-logical disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-im-hover",
  {
    variants: {
      tone: {
        logical: "aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical",
        warn: "aria-pressed:bg-im-warn-soft aria-pressed:text-im-warn",
        plain: "aria-pressed:text-im-ink",
      },
      size: {
        bar: "h-control-bar",
        toolbar: "size-control-sm justify-center p-0",
      },
    },
    defaultVariants: { tone: "logical", size: "bar" },
  },
)
