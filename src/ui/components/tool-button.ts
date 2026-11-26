// Slice 37 (S37-02, step 4): the top bar's tool button (`.im-btn.icon` at the bar's 30 px, `control-bar`): no edge, no
// fill until hovered, pressed in a tone (`logical` the accent's soft fill, `warn` the Changes view's, `plain` the ink
// only: a side panel's toggle). Its padding is the caller's breakpoints' (F15: every top-bar control keeps its width),
// so the look carries none; a label beside the icon is the caller's too.
import { cva } from "class-variance-authority"

export const toolButtonVariants = cva(
  "inline-flex h-control-bar flex-none items-center gap-1.5 rounded-md text-im-ink-2 outline-none hover:bg-im-hover hover:text-im-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-im-logical disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-im-hover",
  {
    variants: {
      tone: {
        logical: "aria-pressed:bg-im-logical-soft aria-pressed:text-im-logical",
        warn: "aria-pressed:bg-im-warn-soft aria-pressed:text-im-warn",
        plain: "aria-pressed:text-im-ink",
      },
    },
    defaultVariants: { tone: "logical" },
  },
)
