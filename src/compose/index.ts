// The composition root (slice 15a, AD-33, acceptance doc Q2): the only code that imports a module. `src/app` imports
// it and hands the modules' hooks down as arguments and context; InfoMapper's other layers never import it.

export { relationshipOneEnd } from "./model";
export { STORE_SCHEMA, UNDO_TABLES } from "./tables";
export { moduleEntityDependents, moduleLines, moduleView, type CreateActions } from "./view";
