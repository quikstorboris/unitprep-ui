import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrchestratorLoader } from "./OrchestratorLoader";

// jsdom has no canvas 2d backend, so `getContext("2d")` returns null --
// these tests only cover the ARIA/DOM contract the component promises,
// not the actual pixels. The component is written to no-op its canvas
// drawing when ctx is null rather than throw, which is itself the thing
// worth pinning down here (a real regression would surface as an
// unhandled rejection from the rAF loop, failing the whole suite).
describe("OrchestratorLoader", () => {
  it("renders as a labeled progressbar without a canvas backend", () => {
    render(<OrchestratorLoader label="Fetching data from Process Street…" />);

    const bar = screen.getByRole("progressbar", { name: "Fetching data from Process Street…" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("Fetching data from Process Street…")).toBeInTheDocument();
  });

  it("defaults the label to Loading", () => {
    render(<OrchestratorLoader />);

    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
  });

  it("accepts a numeric progress prop without crashing", () => {
    render(<OrchestratorLoader label="Importing units" progress={0.42} />);

    expect(screen.getByRole("progressbar", { name: "Importing units" })).toBeInTheDocument();
  });
});
