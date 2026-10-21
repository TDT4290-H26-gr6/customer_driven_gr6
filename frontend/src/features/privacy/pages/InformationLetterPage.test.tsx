import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

  it("goes back to the page it was opened from", async () => {
    render(
      <MemoryRouter initialEntries={["/profile", "/information-letter"]} initialIndex={1}>
        <Routes>
          <Route path="/profile" element={<p>profile step</p>} />
          <Route path="/information-letter" element={<InformationLetterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    // MemoryRouter doesn't set window.history.state, so mimic the browser's index.
    window.history.replaceState({ idx: 1 }, "");

    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText("profile step")).toBeInTheDocument();
  });

  it("goes home when opened directly", async () => {
    window.history.replaceState({ idx: 0 }, "");
    render(
      <MemoryRouter initialEntries={["/information-letter"]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route path="/information-letter" element={<InformationLetterPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
