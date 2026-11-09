// The concept of a new entity, fact or dimension outside a concept frame is chosen, never suggested (slice 17, D-72,
// changes D-46; prototype pickConcept): a picker with nothing preselected, at the click or under the button. Slice 21
// (D-76): its last item "New concept “{text}”" while the typed text names no concept; it makes the concept with the
// entity, fact or dimension in one undo step (`newConcept`).

import { openPick } from "@/ui/pick-popover";

export const NO_CONCEPTS = "No concepts yet. Type a name to create one.";
export const CONCEPT_FILTER = "Type to filter or name a new concept…";
export const newConceptItem = (text: string) => `New concept “${text}”`;

interface ConceptChoice {
  id: string;
  name: string;
  color: string;
}

/**
 * Opens the concept picker with the concepts in panel order; `then` gets the chosen one, `newConcept` the name typed
 * for a new one. Escape or a press outside creates nothing.
 */
export function pickConcept<C extends ConceptChoice>(
  at: { x: number; y: number },
  role: "entity" | "fact" | "dimension",
  ordered: readonly C[],
  then: (concept: C) => void,
  newConcept?: (name: string) => void,
): void {
  openPick({
    at,
    title: `Concept for the new ${role}`,
    placeholder: CONCEPT_FILTER,
    empty: NO_CONCEPTS,
    items: ordered.map((c) => ({ id: c.id, label: c.name, color: c.color })),
    testId: "picker-concept",
    pick: ([id]) => {
      const concept = ordered.find((c) => c.id === id);
      if (concept) then(concept);
    },
    ...(newConcept ? { create: { label: newConceptItem, act: newConcept } } : {}),
  });
}
