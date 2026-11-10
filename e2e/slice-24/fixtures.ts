// Slice 24 uses slice 0's fixture: the e2e data file is reseeded before every test (the plain seed, no star). S24-07's
// InfoCube part uses slice 15a's fixture (the Sales star) in its own file's `test.use`.

export { expect, test, type Page } from "../slice-00/fixtures";
