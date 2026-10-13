import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ImplementationManagerLine from "./ImplementationManagerLine";

describe("ImplementationManagerLine", () => {
  it("names the assigned manager", () => {
    render(<ImplementationManagerLine manager={{ id: "u1", name: "John Doe" }} />);

    expect(screen.getByText("Implementation manager:")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("says so when nobody is assigned", () => {
    render(<ImplementationManagerLine manager={null} />);

    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });
});
