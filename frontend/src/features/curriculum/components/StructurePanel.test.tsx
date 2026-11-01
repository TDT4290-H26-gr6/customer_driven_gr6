import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modulesApi, sectionsApi } from "../api";
import { curriculum, curriculumModule, curriculumSection } from "../testData";
import { StructurePanel } from "./StructurePanel";

vi.mock("../api", () => ({
  sectionsApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
  modulesApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}));

const onChanged = vi.fn();
const data = curriculum();

function renderPanel(sections = data.sections) {
  render(
    <StructurePanel sections={sections} competences={data.competences} onChanged={onChanged} />,
  );
}

const confirm = () => vi.spyOn(window, "confirm");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StructurePanel: sections", () => {
  it("lists sections with their modules, competences, question counts and Moodle links", () => {
    renderPanel();
    const sectionA = screen.getByRole("region", { name: "Open data" });
    expect(within(sectionA).getByText("Finding, sharing and reusing data")).toBeInTheDocument();
    expect(within(sectionA).getByText("A · Licences (level 1)")).toBeInTheDocument();
    expect(
      within(sectionA).getByText(/Licensing \(\+1 secondary\) · 2 questions/),
    ).toBeInTheDocument();
    expect(within(sectionA).getByRole("link", { name: "Moodle page" })).toHaveAttribute(
      "href",
      "https://moodle.example.org/course/view.php?id=1",
    );
  });

  it("adds a section", async () => {
    vi.mocked(sectionsApi.create).mockResolvedValue({ id: "sec-f" });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    const form = screen.getByRole("form", { name: "New section" });
    await userEvent.type(within(form).getByRole("textbox", { name: "Code (optional)" }), "F");
    await userEvent.type(within(form).getByRole("textbox", { name: "Name" }), "Open education");
    await userEvent.click(within(form).getByRole("button", { name: "Add section" }));

    expect(sectionsApi.create).toHaveBeenCalledWith({
      code: "F",
      name: "Open education",
      description: null,
    });
    expect(onChanged).toHaveBeenCalledWith("Section added.");
  });

  it("edits a section and shows a refusal from the server", async () => {
    vi.mocked(sectionsApi.update).mockRejectedValueOnce({
      status: 409,
      message: "A section with that name or code already exists",
    });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit Open data" }));
    const form = screen.getByRole("form", { name: "Edit Open data" });
    const name = within(form).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Open code");
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("already exists");
    expect(onChanged).not.toHaveBeenCalled();

    vi.mocked(sectionsApi.update).mockResolvedValueOnce({ id: "sec-a" });
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(sectionsApi.update).toHaveBeenLastCalledWith("sec-a", {
      code: "A",
      name: "Open code",
      description: "Finding, sharing and reusing data",
    });
    expect(onChanged).toHaveBeenCalledWith("Section saved.");
  });

  it("cancels an edit", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit Open data" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("deletes an empty section, saying it's for good", async () => {
    const ask = confirm().mockReturnValue(true);
    vi.mocked(sectionsApi.remove).mockResolvedValue({ result: "deleted" });
    renderPanel([curriculumSection({ id: "sec-e", name: "Empty" })]);

    await userEvent.click(screen.getByRole("button", { name: "Remove Empty" }));

    expect(ask.mock.calls[0][0]).toContain("deleted for good");
    expect(sectionsApi.remove).toHaveBeenCalledWith("sec-e");
    expect(onChanged).toHaveBeenCalledWith("Section deleted.");
  });

  it("retires a section in use, saying what's kept and which journeys cover it", async () => {
    const ask = confirm().mockReturnValue(true);
    vi.mocked(sectionsApi.remove).mockResolvedValue({ result: "retired" });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Remove Open data" }));

    expect(ask.mock.calls[0][0]).toContain("retired");
    expect(ask.mock.calls[0][0]).toContain("2 learning journeys cover it");
    expect(onChanged).toHaveBeenCalledWith("Section retired.");
  });

  it("says when one journey covers it", async () => {
    const ask = confirm().mockReturnValue(false);
    renderPanel([curriculumSection({ journeyCount: 1 })]);
    await userEvent.click(screen.getByRole("button", { name: "Remove Open data" }));
    expect(ask.mock.calls[0][0]).toContain("1 learning journey covers it");
    expect(sectionsApi.remove).not.toHaveBeenCalled();
  });

  it("shows removed sections on request and restores one", async () => {
    vi.mocked(sectionsApi.restore).mockResolvedValue(undefined);
    renderPanel([
      ...data.sections,
      curriculumSection({ id: "sec-x", name: "Old section", retiredAt: "2026-10-01" }),
    ]);
    expect(screen.queryByRole("region", { name: "Old section" })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Show removed sections and modules \(1\)/ }),
    );
    const old = screen.getByRole("region", { name: "Old section" });
    expect(within(old).getByText("Removed")).toBeInTheDocument();
    // A removed section can't get new modules.
    expect(within(old).queryByRole("button", { name: /Add a module/ })).not.toBeInTheDocument();

    await userEvent.click(within(old).getByRole("button", { name: "Restore Old section" }));
    expect(sectionsApi.restore).toHaveBeenCalledWith("sec-x");
    expect(onChanged).toHaveBeenCalledWith("Section restored.");
  });

  it("reports a failed remove or restore", async () => {
    confirm().mockReturnValue(true);
    vi.mocked(sectionsApi.remove).mockRejectedValue(new Error("500"));
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Remove Open data" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not make that change");
  });
});

describe("StructurePanel: modules", () => {
  it("adds a module at the next level, with secondary competences and a Moodle link", async () => {
    vi.mocked(modulesApi.create).mockResolvedValue({ id: "mod-new" });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "+ Add a module to Open data" }));
    const form = screen.getByRole("form", { name: "New module in Open data" });
    expect(within(form).getByRole("spinbutton", { name: "Level (optional)" })).toHaveValue(3);

    await userEvent.type(within(form).getByRole("textbox", { name: "Name" }), "Data citation");
    await userEvent.selectOptions(
      within(form).getByRole("combobox", { name: "Main competence" }),
      "c-rep",
    );
    await userEvent.click(within(form).getByRole("checkbox", { name: "Version control" }));
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Link to its page in Moodle (optional)" }),
      "https://moodle.ntnu.no/course/view.php?id=9",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add module" }));

    expect(modulesApi.create).toHaveBeenCalledWith({
      name: "Data citation",
      description: null,
      sectionId: "sec-a",
      level: 3,
      mainCompetenceId: "c-rep",
      secondaryCompetenceIds: ["c-git"],
      moodleUrl: "https://moodle.ntnu.no/course/view.php?id=9",
    });
    expect(onChanged).toHaveBeenCalledWith("Module added.");
  });

  it("edits a module, warning when one with questions moves, and can clear its level", async () => {
    vi.mocked(modulesApi.update).mockResolvedValue({ id: "mod-a1" });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Edit Licences" }));
    const form = screen.getByRole("form", { name: "Edit Licences" });
    // The main competence isn't offered as a secondary one.
    expect(within(form).queryByRole("checkbox", { name: "Licensing" })).not.toBeInTheDocument();
    expect(within(form).getByRole("checkbox", { name: "Repositories" })).toBeChecked();
    expect(within(form).queryByText(/Moving it or changing its level/)).not.toBeInTheDocument();

    await userEvent.selectOptions(within(form).getByRole("combobox", { name: "Section" }), "sec-b");
    expect(within(form).getByText(/This module has 2 questions/)).toBeInTheDocument();

    await userEvent.clear(within(form).getByRole("spinbutton", { name: "Level (optional)" }));
    await userEvent.click(within(form).getByRole("checkbox", { name: "Repositories" }));
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(modulesApi.update).toHaveBeenCalledWith(
      "mod-a1",
      expect.objectContaining({ sectionId: "sec-b", level: null, secondaryCompetenceIds: [] }),
    );
    expect(onChanged).toHaveBeenCalledWith("Module saved.");
  });

  it("drops a secondary competence that becomes the main one", async () => {
    vi.mocked(modulesApi.update).mockResolvedValue({ id: "mod-a1" });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit Licences" }));
    const form = screen.getByRole("form", { name: "Edit Licences" });
    await userEvent.selectOptions(
      within(form).getByRole("combobox", { name: "Main competence" }),
      "c-rep",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(modulesApi.update).toHaveBeenCalledWith(
      "mod-a1",
      expect.objectContaining({ mainCompetenceId: "c-rep", secondaryCompetenceIds: [] }),
    );
  });

  it("shows a general error when saving fails for another reason", async () => {
    vi.mocked(modulesApi.update).mockRejectedValue(new Error("offline"));
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit Licences" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  });

  it.each([
    ["Repositories", 0, "deleted", "deleted for good", "Module deleted."],
    ["Licences", 2, "retired", "its 2 questions are no longer asked", "Module retired."],
  ] as const)("removing %s (%i questions)", async (name, _count, result, message, notice) => {
    const ask = confirm().mockReturnValue(true);
    vi.mocked(modulesApi.remove).mockResolvedValue({ result });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: `Remove ${name}` }));
    expect(ask.mock.calls[0][0]).toContain(message);
    expect(onChanged).toHaveBeenCalledWith(notice);
  });

  it("doesn't remove a module when the confirmation is cancelled", async () => {
    confirm().mockReturnValue(false);
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Remove Licences" }));
    expect(modulesApi.remove).not.toHaveBeenCalled();
  });

  it("shows removed modules on request and restores one", async () => {
    vi.mocked(modulesApi.restore).mockResolvedValue(undefined);
    renderPanel([
      curriculumSection({
        modules: [curriculumModule({ id: "mod-old", name: "Old module", retiredAt: "2026-10-01" })],
      }),
    ]);
    expect(screen.getByText("No modules yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Show removed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Restore Old module" }));
    expect(modulesApi.restore).toHaveBeenCalledWith("mod-old");
    expect(onChanged).toHaveBeenCalledWith("Module restored.");
  });
});
