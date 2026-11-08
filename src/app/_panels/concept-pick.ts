// The concept of a new entity, fact or dimension outside a concept frame is chosen, never suggested (slice 17, D-72,
// changes D-46; prototype pickConcept): a picker with nothing preselected, at the click or under the button.

import { openPick } from "@/ui/pick-popover";

export const NO_CONCEPTS = "No concepts yet. Create one in the Model tab (New concept).";

interface ConceptChoice {
  id: string;
  name: string;
  color: string;
}

/**
 * Opens the concept picker with the concepts in panel order; `then` gets the chosen one. Escape or a press outside
 * creates nothing.
 */
export function pickConcept<C extends ConceptChoice>(
  at: { x: number; y: number },
  role: "entity" | "fact" | "dimension",
  ordered: readonly C[],
  then: (concept: C) => void,
): void {
  openPick({
    at,
    title: `Concept for the new ${role}`,
    placeholder: "Type to filter concepts…",
    empty: NO_CONCEPTS,
    items: ordered.map((c) => ({ id: c.id, label: c.name, color: c.color })),
    testId: "picker-concept",
    pick: ([id]) => {
      const concept = ordered.find((c) => c.id === id);
      if (concept) then(concept);
    },
  });
}
