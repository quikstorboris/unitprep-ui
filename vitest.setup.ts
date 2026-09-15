import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView at all -- any component that
// calls it (e.g. keyboard-navigating a dropdown's highlighted option
// into view, as MultiSelectDropdown/EventTypeMultiSelect/UserMultiSelect
// all do) throws in tests without this. A real browser always has it;
// this only fills the test environment's gap.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
