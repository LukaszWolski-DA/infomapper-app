// Slice 32's fixtures are slice 28's (27's, 26's, 25's): the e2e data file reseeded before every test, with `seed` "docs"
// (the default: InfoDocumenter's demo, no star), "plain" or "full". The theme writes nothing, so the seed only matters
// for what a test opens (S32-03 opens a document).

export { expect, test, type Page } from "../slice-28/fixtures";
