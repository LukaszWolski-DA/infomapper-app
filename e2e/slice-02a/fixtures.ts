// Slice 2a uses slice 0's fixture: the e2e data file is reseeded before every test, so each test starts from the
// demo model and no test depends on another; the undo history starts empty too.

export { expect, test, type Page } from "../slice-00/fixtures";
