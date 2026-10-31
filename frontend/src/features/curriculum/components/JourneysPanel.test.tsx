import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { journeysApi } from "../api";
import { curriculum } from "../testData";
import type { CurriculumJourney } from "../types";
import { JourneysPanel } from "./JourneysPanel";

vi.mock("../api", () => ({
  journeysApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}));

const onChanged = vi.fn();
const data = curriculum();

function renderPanel(journeys: CurriculumJourney[] = data.journeys) {
  render(
    <MemoryRouter initialEntries={["/admin/curriculum"]}>
      <Routes>
        <Route
          path="/admin/curriculum"
          element={
            <JourneysPanel journeys={journeys} sections={data.sections} onChanged={onChanged} />
          }
        />
        <Route path="/admin/curriculum/journeys/:id" element={<p>journey editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JourneysPanel", () => {
  it("shows each journey's coverage by level, steps and Moodle link", () => {
    renderPanel();
    const steward = screen.getByRole("region", { name: "Data steward" });
    expect(within(steward).getByText("Main (M)").nextSibling).toHaveTextContent("A Open data");
    expect(within(steward).getByText("Supplementary (S)").nextSibling).toHaveTextContent(
      "B Open code",
    );
    expect(within(steward).queryByText("Recommended (R)")).not.toBeInTheDocument();
    expect(within(steward).getByText(/2 steps/)).toBeInTheDocument();
    expect(within(steward).getByRole("link", { name: "Moodle page" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Open code" })).getByText(/0 steps/),
    ).toBeInTheDocument();
  });

  it("opens a journey, or a new one, in the editor", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit Data steward" }));
    expect(screen.getByText("journey editor")).toBeInTheDocument();
  });

  it("retires a journey learners have used, saying what's kept", async () => {
    const ask = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(journeysApi.remove).mockResolvedValue({ result: "retired" });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Remove Data steward" }));

    expect(ask.mock.calls[0][0]).toContain("retired");
    expect(journeysApi.remove).toHaveBeenCalledWith("lj-1");
    expect(onChanged).toHaveBeenCalledWith("Journey retired.");
  });

  it("deletes an unused journey, saying it's for good", async () => {
    const ask = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(journeysApi.remove).mockResolvedValue({ result: "deleted" });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Remove Open code" }));
    expect(ask.mock.calls[0][0]).toContain("deleted for good");
    expect(onChanged).toHaveBeenCalledWith("Journey deleted.");
  });

  it("does nothing when removal isn't confirmed, and reports a failure", async () => {
    const ask = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Remove Open code" }));
    expect(journeysApi.remove).not.toHaveBeenCalled();

    ask.mockReturnValue(true);
    vi.mocked(journeysApi.remove).mockRejectedValue(new Error("500"));
    await userEvent.click(screen.getByRole("button", { name: "Remove Open code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not make that change");
  });

  it("shows removed journeys on request and restores one", async () => {
    vi.mocked(journeysApi.restore).mockResolvedValue(undefined);
    renderPanel([
      ...data.journeys,
      { ...data.journeys[1], id: "lj-old", name: "Old journey", retiredAt: "2026-10-01" },
    ]);
    expect(screen.queryByRole("region", { name: "Old journey" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Show removed journeys (1)" }));
    const old = screen.getByRole("region", { name: "Old journey" });
    expect(within(old).getByText("Removed")).toBeInTheDocument();
    await userEvent.click(within(old).getByRole("button", { name: "Restore Old journey" }));
    expect(journeysApi.restore).toHaveBeenCalledWith("lj-old");
    expect(onChanged).toHaveBeenCalledWith("Journey restored.");
  });

  it("says so when there are no journeys", () => {
    renderPanel([]);
    expect(screen.getByText("No learning journeys yet.")).toBeInTheDocument();
  });
});
