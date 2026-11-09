// Slice 21 uses slice 0's fixture: the e2e data file is reseeded before every test (the plain seed: InfoCube off), and
// every test starts with an empty browser profile. Its InfoCube parts use slice 15a's (the Sales star) through
// `starTest` in the specs.

export { expect, test, type Page } from "../slice-00/fixtures";
export { test as starTest } from "../slice-15a/fixtures";
