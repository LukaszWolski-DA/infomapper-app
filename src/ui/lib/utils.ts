// Slice 37: the one class merger. tailwind-merge (through `cn`) does not know the design system's own scales, so it read
// `text-body` as a text colour and dropped `text-im-ink` beside it, and never merged `h-control-md` with `h-8`. It is
// told the type scale (`text-title` … `text-code`) and the control sizes (`control-md`, `control-sm`, `control-bar`,
// `target`) from `globals.css`' `@theme`. Every `src/ui` component merges with this one, never with `cn` directly.
import { createCn } from "cn/config"

export const cn = createCn({
  extend: {
    theme: { spacing: ["control-md", "control-sm", "control-bar", "target"] },
    classGroups: { "font-size": [{ text: ["title", "section", "body", "small", "label", "code"] }] },
  },
})
