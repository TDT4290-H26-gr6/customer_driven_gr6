import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { InformationLetterPage } from "./InformationLetterPage";

describe("InformationLetterPage", () => {
  it("shows the letter with its sections", () => {
    render(
      <MemoryRouter>
        <InformationLetterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Information letter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your rights" })).toBeInTheDocument();
    expect(screen.getByText(/NTNU is responsible/)).toBeInTheDocument();
  });
});
