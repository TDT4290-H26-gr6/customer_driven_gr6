import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurriculum, journeysApi } from "../api";
import { curriculum, curriculumSection } from "../testData";
import { JourneyEditorPage } from "./JourneyEditorPage";

vi.mock("../api", () => ({
  getCurriculum: vi.fn(),
  journeysApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}));

function Overview() {
  const state = useLocation().state as { notice?: string; tab?: string } | null;
  return (
    <p>
      overview: {state?.notice} ({state?.tab})
    </p>
  );
}

function renderEditor(path = "/admin/curriculum/journeys/new") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/curriculum/journeys/new" element={<JourneyEditorPage />} />
        <Route path="/admin/curriculum/journeys/:id" element={<JourneyEditorPage />} />
        <Route path="/admin/curriculum" element={<Overview />} />
      </Routes>
    </MemoryRouter>,
  );
}

const coverageOf = (section: string) =>
  screen.getByRole("combobox", { name: `Coverage of ${section}` });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurriculum).mockResolvedValue(curriculum());
  vi.mocked(journeysApi.create).mockResolvedValue({ id: "lj-new" });
  vi.mocked(journeysApi.update).mockResolvedValue({ id: "lj-1" });
});

describe("JourneyEditorPage: a new journey", () => {
  it("adds a journey with its coverage and steps, then returns to the journeys tab", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Add a learning journey" });

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Data steward");
    await userEvent.type(screen.getByRole("textbox", { name: /^Description/ }), "For data work");
    await userEvent.selectOptions(coverageOf("Open data"), "M");
    await userEvent.selectOptions(coverageOf("Open code"), "R");

    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Step 1 title" }), "Plan your data");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Step 1 learning resource" }),
      "src-1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Step 2 title" }), "Share it");
    await userEvent.type(screen.getByRole("textbox", { name: "Step 2 description" }), "Publish");

    await userEvent.click(screen.getByRole("button", { name: "Add journey" }));

    expect(journeysApi.create).toHaveBeenCalledWith({
      name: "Data steward",
      description: "For data work",
      moodleUrl: null,
      sections: [
        { sectionId: "sec-a", coverageLevel: "M" },
        { sectionId: "sec-b", coverageLevel: "R" },
      ],
      steps: [
        { id: null, title: "Plan your data", description: null, sourceId: "src-1" },
        { id: null, title: "Share it", description: "Publish", sourceId: null },
      ],
    });
    expect(await screen.findByText("overview: Journey added. (journeys)")).toBeInTheDocument();
  });

  it("shows the server's reason when a save is refused", async () => {
    vi.mocked(journeysApi.create).mockRejectedValue({
      status: 400,
      message: "Mark at least one section as M (main)",
    });
    renderEditor();
    await screen.findByRole("heading", { name: "Add a learning journey" });
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add journey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least one section as M");
  });

  it("shows a general error when the save fails for another reason", async () => {
    vi.mocked(journeysApi.create).mockRejectedValue(new Error("offline"));
    renderEditor();
    await screen.findByRole("heading", { name: "Add a learning journey" });
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add journey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the journey");
  });
});

describe("JourneyEditorPage: an existing journey", () => {
  it("loads it, reorders and removes steps keeping their ids, and saves", async () => {
    renderEditor("/admin/curriculum/journeys/lj-1");
    expect(
      await screen.findByRole("heading", { name: "Edit learning journey" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Learners have been recommended/)).toBeInTheDocument();
    expect(coverageOf("Open data")).toHaveValue("M");
    expect(coverageOf("Open code")).toHaveValue("S");
    expect(screen.getByRole("textbox", { name: "Step 2 description" })).toHaveValue(
      "In a repository",
    );

    await userEvent.click(screen.getByRole("button", { name: "Move step 2 up" }));
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Step 3 title" }), "Cite it");
    await userEvent.click(screen.getByRole("button", { name: "Move step 3 up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move step 1 down" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove step 3" }));
    await userEvent.selectOptions(coverageOf("Open code"), "");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(journeysApi.update).toHaveBeenCalledWith("lj-1", {
      name: "Data steward",
      description: "For research data work",
      moodleUrl: "https://moodle.example.org/course/view.php?id=3",
      sections: [{ sectionId: "sec-a", coverageLevel: "M" }],
      steps: [
        { id: null, title: "Cite it", description: null, sourceId: null },
        { id: "step-2", title: "Share it", description: "In a repository", sourceId: null },
      ],
    });
    expect(await screen.findByText("overview: Journey saved. (journeys)")).toBeInTheDocument();
  });

  it("offers sections in use, plus a removed one it already covers", async () => {
    const data = curriculum();
    data.sections.push(
      curriculumSection({
        id: "sec-x",
        code: "X",
        name: "Removed covered",
        retiredAt: "2026-10-01",
      }),
      curriculumSection({
        id: "sec-y",
        code: "Y",
        name: "Removed uncovered",
        retiredAt: "2026-10-01",
      }),
    );
    data.journeys[0].sections.push({ sectionId: "sec-x", coverageLevel: "R" });
    vi.mocked(getCurriculum).mockResolvedValue(data);
    renderEditor("/admin/curriculum/journeys/lj-1");

    await screen.findByRole("heading", { name: "Edit learning journey" });
    const row = coverageOf("Removed covered").closest("li")!;
    expect(within(row).getByText("Removed")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Coverage of Removed uncovered" }),
    ).not.toBeInTheDocument();
  });

  it("says so when the journey doesn't exist", async () => {
    renderEditor("/admin/curriculum/journeys/gone");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the journey");
    expect(screen.getByRole("link", { name: "Back to the curriculum editor" })).toBeInTheDocument();
  });

  it("says so when the curriculum can't be loaded", async () => {
    vi.mocked(getCurriculum).mockRejectedValue(new Error("offline"));
    renderEditor("/admin/curriculum/journeys/lj-1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the journey");
  });
});
