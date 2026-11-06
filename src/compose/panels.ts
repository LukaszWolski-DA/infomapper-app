// The modules' sections in InfoMapper's panels (slice 15b, AD-33): the entity's, the attribute's and the relationship's
// panel render every module's section of their kind where the prototype shows InfoCube's, and know nothing else of
// them. Each section renders nothing for an object it does not describe. Apart from `src/compose/index.ts`, so that
// the domain's and the store's callers never load client components.

import type { ComponentType } from "react";
import type { Attribute, Entity, Relationship } from "@/domain/types";
import { CubeAttributeSection, CubeEntitySection, CubeRelationshipSection } from "@/modules/infocube/app/sections";
import { CubeAttributeFeeds } from "@/modules/infocube/app/feeds";

export interface PanelSections {
  /** After the entity's definition (prototype `cubeEntitySection`). */
  entity: ComponentType<{ entity: Entity }>[];
  /** After the attribute's flags (prototype `cubeMeasureSection`). */
  attribute: ComponentType<{ attribute: Attribute }>[];
  /**
   * Where the attribute's sources are (slice 15c, C10): after InfoMapper's "Comes from", which a dimensional attribute
   * does not show (prototype `cubeAttrSection`: "Comes from the logical model", "Feeds facts and dimensions").
   */
  attributeFeeds: ComponentType<{ attribute: Attribute }>[];
  /** After the relationship's cardinalities (prototype `relKeySection`). */
  relationship: ComponentType<{ relationship: Relationship }>[];
}

export const PANEL_SECTIONS: PanelSections = {
  entity: [CubeEntitySection],
  attribute: [CubeAttributeSection],
  attributeFeeds: [CubeAttributeFeeds],
  relationship: [CubeRelationshipSection],
};
