// Concept colours come from the workspace palette (prototype ALLOWED_CONCEPT_COLORS). Violet is reserved for
// requirements and is never offered (D-41).

export const CONCEPT_PALETTE = ["#2F7DD1", "#0F8B8D", "#C0437A", "#5F8A2E", "#B7791F", "#D85A30", "#5F6B7A", "#1D9E75"] as const;

export const isConceptColor = (color: string): boolean => (CONCEPT_PALETTE as readonly string[]).includes(color.toUpperCase());

/** The first palette colour no concept uses yet; when all are used, the palette repeats. */
export function nextConceptColor(usedColors: readonly string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()));
  return CONCEPT_PALETTE.find((c) => !used.has(c)) ?? CONCEPT_PALETTE[usedColors.length % CONCEPT_PALETTE.length]!;
}
