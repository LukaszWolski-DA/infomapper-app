// Where the top bar's tools move into “More” (slice 6a, item 9; widths measured in step 4). A plain module, so the
// canvas page (a server component) and `MoreTools` (a client one) share the class names; each goes on the tool's own
// element in the bar (`inBar`) or on its item in the menu (`inMenu`), never on the page (AD-24 rule 4).

/** Up to 1,200 px: Focus and the notation switch. */
export const MORE_FOCUS = { inBar: "max-[1201px]:hidden", inMenu: "min-[1201px]:hidden" } as const;
/** Up to 1,100 px: also the Entity, Frame, Note and Hand tools. */
export const MORE_TOOLS = { inBar: "max-[1101px]:hidden", inMenu: "min-[1101px]:hidden" } as const;
