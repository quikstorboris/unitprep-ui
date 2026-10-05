import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalOwnerSourceNotice } from "./LegalOwnerSourceNotice";

describe("LegalOwnerSourceNotice", () => {
  it("names the sister facility the owners came from", () => {
    render(<LegalOwnerSourceNotice source={{ facility_id: "f1", facility_name: "Affordable Storage Westpark" }} />);

    expect(screen.getByText(/Legal Owner checkmarks come from/)).toBeInTheDocument();
    expect(screen.getByText("Affordable Storage Westpark")).toBeInTheDocument();
    expect(screen.getByText(/no Merchant Account form with owners of its own yet/)).toBeInTheDocument();
  });

  it("renders nothing when the owners are this facility's own", () => {
    const { container } = render(<LegalOwnerSourceNotice source={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
