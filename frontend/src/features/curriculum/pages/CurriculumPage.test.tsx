import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadChangeLog,
  downloadCurriculum,
  getCurriculum,
  removeQuestion,
  restoreQuestion,
  sectionsApi,
} from "../api";
import { curriculum, curriculumModule, curriculumSection } from "../testData";
import { CurriculumPage } from "./CurriculumPage";

vi.mock("../api", () => ({
  sectionsApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
  modulesApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
  journeysApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
  getCurriculum: vi.fn(),
  removeQuestion: vi.fn(),
  restoreQuestion: vi.fn(),
  createCompetence: vi.fn(),
  updateCompetence: vi.fn(),
  downloadCurriculum: vi.fn(),
  downloadChangeLog: vi.fn(),
}));

function renderPage(state?: object) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/admin/curriculum", state }]}>
      <Routes>
        <Route path="/admin/curriculum" element={<CurriculumPage />} />
        <Route path="/admin/curriculum/questions/:id" element={<p>editor page</p>} />
        <Route path="/admin" element={<p>admin mode</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const prompts = () =>
  screen.queryAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurriculum).mockResolvedValue(curriculum());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CurriculumPage", () => {
  it("lists the questions in use by section and module, empty modules included", async () => {
    renderPage();
    expect(await screen.findByRole("tab", { name: "Questions (2)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const sectionA = screen.getByRole("region", { name: "Open data" });
    expect(within(sectionA).getByText("A · Licences (level 1)")).toBeInTheDocument();
    expect(within(sectionA).getByText("No questions yet.")).toBeInTheDocument();
    expect(
      within(sectionA).getByText(/Single choice · Licensing · Not answered yet/),
    ).toBeInTheDocument();
    expect(
      within(sectionA).getByText(/Self-rating scale · Licensing · Answered 7 times/),
    ).toBeInTheDocument();
    // The removed question is hidden until asked for.
    expect(screen.queryByText("Git keeps every version of a file.")).not.toBeInTheDocument();
  });

  it("filters by section, type and words", async () => {
    renderPage();
    await screen.findByRole("tab", { name: "Questions (2)" });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Question type" }),
      "likert",
    );
    expect(prompts()).toEqual(["How confident are you choosing a licence?"]);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Question type" }), "");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "reuse");
    expect(prompts()).toEqual(["Which licence lets anyone reuse data?"]);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), " nothing");
    expect(screen.getByText("No questions match.")).toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox", { name: "Search" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Section" }), "sec-b");
    expect(screen.queryByRole("region", { name: "Open data" })).not.toBeInTheDocument();
  });

  it("shows removed questions on request, and restores one", async () => {
    vi.mocked(restoreQuestion).mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Show removed questions (1)" }),
    );
    const removed = screen.getByText("Git keeps every version of a file.").closest("li")!;
    expect(within(removed).getByText("Removed")).toBeInTheDocument();

    await userEvent.click(within(removed).getByRole("button", { name: "Restore" }));
    expect(restoreQuestion).toHaveBeenCalledWith("q-3");
    expect(await screen.findByRole("status")).toHaveTextContent("Question restored.");
    expect(getCurriculum).toHaveBeenCalledTimes(2);
  });

  it("deletes an unanswered question after confirming, saying it's for good", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(removeQuestion).mockResolvedValue({ result: "deleted" });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Remove: Which licence lets anyone reuse data?" }),
    );

    expect(confirm.mock.calls[0][0]).toContain("deleted for good");
    expect(removeQuestion).toHaveBeenCalledWith("q-1");
    expect(await screen.findByRole("status")).toHaveTextContent("Question deleted.");
  });

  it("retires an answered question, saying past results keep it", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(removeQuestion).mockResolvedValue({ result: "retired" });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Remove: How confident are you choosing a licence?",
      }),
    );

    expect(confirm.mock.calls[0][0]).toContain("retired");
    expect(confirm.mock.calls[0][0]).toContain("7 times");
    expect(await screen.findByRole("status")).toHaveTextContent("Question retired.");
  });

  it("does nothing when the removal isn't confirmed, and reports a failure", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    const remove = await screen.findByRole("button", {
      name: "Remove: Which licence lets anyone reuse data?",
    });
    await userEvent.click(remove);
    expect(removeQuestion).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    vi.mocked(removeQuestion).mockRejectedValue(new Error("500"));
    await userEvent.click(remove);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not remove");
  });

  it("reports a failed restore", async () => {
    vi.mocked(restoreQuestion).mockRejectedValue(new Error("500"));
    renderPage();
    await userEvent.click(await screen.findByRole("checkbox", { name: /Show removed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not restore");
  });

  it("opens a question for editing", async () => {
    renderPage();
    const row = (await screen.findByText("Which licence lets anyone reuse data?")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    expect(screen.getByText("editor page")).toBeInTheDocument();
  });

  it("links to adding a question to a specific module", async () => {
    renderPage();
    const links = await screen.findAllByRole("link", { name: "+ Add a question here" });
    expect(links[1]).toHaveAttribute("href", "/admin/curriculum/questions/new?module=mod-a2");
  });

  it("shows the notice a save left behind, and switches to the competences tab", async () => {
    renderPage({ notice: "Question added." });
    await screen.findByRole("tab", { name: "Questions (2)" });
    expect(screen.getByRole("status")).toHaveTextContent("Question added.");

    await userEvent.click(screen.getByRole("tab", { name: "Competences (3)" }));
    expect(screen.getByText("Version control")).toBeInTheDocument();
    expect(screen.getByText("1 question · main competence of 1 module")).toBeInTheDocument();
  });

  it("goes back to admin mode", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Back to admin mode" }));
    expect(screen.getByText("admin mode")).toBeInTheDocument();
  });

  it("says so when the curriculum can't be loaded", async () => {
    vi.mocked(getCurriculum).mockRejectedValue(new Error("403"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the curriculum.");
  });
});

describe("CurriculumPage: retired sections and modules", () => {
  it("counts questions in a removed module as removed, and marks them", async () => {
    const data = curriculum();
    data.sections[0].modules[0].retiredAt = "2026-10-01T00:00:00.000Z";
    vi.mocked(getCurriculum).mockResolvedValue(data);
    renderPage();

    // Only the true/false question in B is left in use, and it's retired itself.
    expect(await screen.findByRole("tab", { name: "Questions (0)" })).toBeInTheDocument();
    expect(screen.queryByText("A · Licences (level 1)")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Show removed questions (3)" }));
    const row = screen.getByText("Which licence lets anyone reuse data?").closest("li")!;
    expect(within(row).getByText("In a removed module")).toBeInTheDocument();
  });

  it("opens the sections & modules tab and reloads after a change there", async () => {
    vi.mocked(sectionsApi.restore).mockResolvedValue(undefined);
    vi.mocked(getCurriculum).mockResolvedValue(
      curriculum({
        sections: [
          curriculumSection({
            id: "sec-x",
            name: "Old",
            retiredAt: "2026-10-01",
            modules: [curriculumModule()],
          }),
        ],
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Sections & modules (0)" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Show removed sections/ }));
    await userEvent.click(screen.getByRole("button", { name: "Restore Old" }));

    expect(await screen.findByText("Section restored.")).toBeInTheDocument();
    expect(getCurriculum).toHaveBeenCalledTimes(2);
  });
});

describe("CurriculumPage: learning journeys", () => {
  it("opens on the journeys tab when the journey editor sends the admin back", async () => {
    renderPage({ notice: "Journey saved.", tab: "journeys" });
    expect(await screen.findByRole("tab", { name: "Learning journeys (2)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("region", { name: "Data steward" })).toBeInTheDocument();
    expect(screen.getByText("Journey saved.")).toBeInTheDocument();
  });
});

describe("CurriculumPage: traceability", () => {
  it("shows who added and last changed a question, and when", async () => {
    renderPage();
    const sectionA = await screen.findByRole("region", { name: "Open data" });
    const history = within(sectionA)
      .getByText(/Added by Ada Admin/)
      .closest("p");
    expect(history).toHaveTextContent(
      /^Added by Ada Admin, 30 Oct 2026, .+ · Edited by bo@ntnu.no, 31 Oct 2026, .+$/,
    );
    // Items loaded from the dataset and never changed show nothing: these two
    // times are that one question's.
    expect(sectionA.querySelectorAll("time")).toHaveLength(2);
  });

  it.each([
    ["Download curriculum (JSON)", downloadCurriculum],
    ["Download change log (CSV)", downloadChangeLog],
  ])("%s, saying 'Downloading…' meanwhile", async (name, download) => {
    let finish!: () => void;
    vi.mocked(download).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Downloading…" })).toBeDisabled();
    finish();
    expect(await screen.findByRole("button", { name })).toBeEnabled();
  });

  it("reports a failed download", async () => {
    vi.mocked(downloadChangeLog).mockRejectedValue(new Error("offline"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Download change log (CSV)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not download that file.");
  });
});
