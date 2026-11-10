// The documentation languages as the selects show them (the settings, and since slice 23 the two places a workspace is
// created: the top bar's "New workspace" and creating an organization; F1).

import type { DocLanguage } from "@/domain/types";

export const DOC_LANGUAGE_OPTIONS: readonly (readonly [DocLanguage, string])[] = [
  ["en", "English"],
  ["pl", "Polski"],
  ["de", "Deutsch"],
];

/** The label of the select at a workspace's creation (slice 23, a deliberate difference from the prototype). */
export const DOC_LANGUAGE_LABEL = "Documentation language";
