// Slice 3a uses slice 0's fixture: the e2e data file is reseeded before every test, so each test starts from the
// demo model with its labels and notes and no test depends on another; the undo history starts empty too.

export { expect, test, type Page } from "../slice-00/fixtures";
