// Slice 3b uses slice 0's fixture: the e2e data file is reseeded before every test, so each test starts from the demo
// model with its labels and notes (and no live canvas: tests make their own) and no test depends on another.

export { expect, test, type Page } from "../slice-00/fixtures";
