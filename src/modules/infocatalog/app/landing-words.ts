// The landing zone's words (slice 39, S39-01: the PRD's texts; InfoCatalog's third bullet as agreed on 27 November 2026).

export const LANDING_TITLE = "InfoLabs apps";
export const LANDING_LEAD =
  "Two apps on one metadata repository: the model is built in InfoMapper and found, read and described in InfoCatalog. A change in one is seen in the other at once.";
export const MAPPER_TILE = {
  name: "InfoMapper",
  tag: "Model and map",
  text: "Build the conceptual, logical and physical model in one place, and map it to the sources.",
  bullets: ["Entities, attributes, relationships and source tables on canvases", "Source-to-target mappings with review and approval", "Requirements, baselines and documentation"],
  button: "Open InfoMapper",
} as const;
export const CATALOG_TILE = {
  name: "InfoCatalog",
  tag: "Find and describe",
  text: (organization: string) => `Search everything the modellers have built, across ${organization} or in one workspace, and see where each item comes from.`,
  bullets: ["Entities, attributes, mappings, sources, requirements and classifications", "From the source column to the attribute and the requirement", "Where each item is used, on canvases and in documents"],
  button: "Open InfoCatalog",
} as const;

export const mapperCount = (n: number, last: string | null) => `${n} workspace${n === 1 ? "" : "s"} you belong to${last ? ` · last: ${last}` : ""}`;
export const catalogCount = (items: number, workspaces: number, organization: string) =>
  `${items.toLocaleString("en")} item${items === 1 ? "" : "s"} in ${workspaces} workspace${workspaces === 1 ? "" : "s"} of ${organization}`;
