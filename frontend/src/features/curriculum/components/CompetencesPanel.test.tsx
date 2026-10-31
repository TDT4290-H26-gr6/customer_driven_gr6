import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompetence, updateCompetence } from "../api";
import { curriculum } from "../testData";
import { CompetencesPanel } from "./CompetencesPanel";

vi.mock("../api", () => ({ createCompetence: vi.fn(), updateCompetence: vi.fn() }));

const onChanged = vi.fn();
const competences = curriculum().competences;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CompetencesPanel", () => {
  it("lists every competence with what uses it", () => {
    render(<CompetencesPanel competences={competences} onChanged={onChanged} />);
    expect(screen.getByText("Licensing")).toBeInTheDocument();
    expect(screen.getByText("Open licences")).toBeInTheDocument();
    expect(screen.getByText("2 questions · main competence of 1 modules")).toBeInTheDocument();
  });

  it("adds a competence", async () => {
    vi.mocked(createCompetence).mockResolvedValue(competences[0]);
    render(<CompetencesPanel competences={competences} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));
    const form = screen.getByRole("form", { name: "New competence" });
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Data citation");
    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));

    expect(createCompetence).toHaveBeenCalledWith({ name: "Data citation", description: null });
    expect(onChanged).toHaveBeenCalled();
    expect(form).not.toBeInTheDocument();
  });

  it("renames a competence, keeping its description", async () => {
    vi.mocked(updateCompetence).mockResolvedValue(competences[0]);
    render(<CompetencesPanel competences={competences} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit Licensing" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Open licensing");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateCompetence).toHaveBeenCalledWith("c-lic", {
      name: "Open licensing",
      description: "Open licences",
    });
  });

  it("shows the server's reason when a save is refused, and can be cancelled", async () => {
    vi.mocked(createCompetence).mockRejectedValue({
      status: 409,
      message: "A competence with that name already exists",
    });
    render(<CompetencesPanel competences={competences} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Licensing");
    await userEvent.click(screen.getByRole("button", { name: "Add competence" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(onChanged).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows a general error for other failures", async () => {
    vi.mocked(updateCompetence).mockRejectedValue(new Error("offline"));
    render(<CompetencesPanel competences={competences} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Repositories" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the competence");
  });
});
