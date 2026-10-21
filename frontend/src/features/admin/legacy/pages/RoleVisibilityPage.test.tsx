import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVisibility } from "../../api";
import type { VisibilityMatrix } from "../../types";
import { setCompetenceGrant, setSectionGrant } from "../api";
import { RoleVisibilityPage } from "./RoleVisibilityPage";

vi.mock("../../api", () => ({ getVisibility: vi.fn() }));
vi.mock("../api", () => ({ setSectionGrant: vi.fn(), setCompetenceGrant: vi.fn() }));

const MATRIX: VisibilityMatrix = {
  roles: [
    { id: "steward", name: "Data steward" },
    { id: "researcher", name: "Researcher" },
  ],
  sections: [
    { id: "sec-a", name: "Data management", description: "Plans and storage" },
    { id: "sec-b", name: "Open access", description: null },
  ],
  competences: [{ id: "c-1", name: "FAIR data", description: null }],
  roleSections: [{ roleId: "steward", sectionId: "sec-a" }],
  roleCompetences: [{ roleId: "researcher", competenceId: "c-1" }],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/admin/roles"]}>
      <Routes>
        <Route path="/admin/roles" element={<RoleVisibilityPage />} />
        <Route path="/admin" element={<p>admin page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVisibility).mockResolvedValue(structuredClone(MATRIX));
  vi.mocked(setSectionGrant).mockResolvedValue(undefined);
  vi.mocked(setCompetenceGrant).mockResolvedValue(undefined);
});

describe("RoleVisibilityPage grants", () => {
  it("shows what the first role is granted", async () => {
    renderPage();
    await screen.findByText("Role visibility");

    expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue("steward");
    expect(within(card("Sections")).getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Data management/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Open access/ })).not.toBeChecked();
    expect(screen.getByText("Plans and storage")).toBeInTheDocument();
    expect(within(card("Competences")).getByText("0 of 1")).toBeInTheDocument();
  });

  it("switches to another role's grants", async () => {
    renderPage();
    await screen.findByText("Role visibility");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "researcher");

    expect(screen.getByRole("checkbox", { name: /Data management/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /FAIR data/ })).toBeChecked();
  });

  it("saves a section grant as soon as it's ticked", async () => {
    renderPage();
    await screen.findByText("Role visibility");

    await userEvent.click(screen.getByRole("checkbox", { name: /Open access/ }));

    expect(setSectionGrant).toHaveBeenCalledWith("steward", "sec-b", true);
    expect(screen.getByRole("checkbox", { name: /Open access/ })).toBeChecked();
    expect(within(card("Sections")).getByText("2 of 2")).toBeInTheDocument();
  });

  it("revokes a competence grant as soon as it's unticked", async () => {
    renderPage();
    await screen.findByText("Role visibility");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "researcher");

    await userEvent.click(screen.getByRole("checkbox", { name: /FAIR data/ }));

    expect(setCompetenceGrant).toHaveBeenCalledWith("researcher", "c-1", false);
    expect(screen.getByRole("checkbox", { name: /FAIR data/ })).not.toBeChecked();
  });

  it("disables a box while its change saves", async () => {
    let finish!: () => void;
    vi.mocked(setSectionGrant).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    await screen.findByText("Role visibility");

    await userEvent.click(screen.getByRole("checkbox", { name: /Open access/ }));
    expect(screen.getByRole("checkbox", { name: /Open access/ })).toBeDisabled();

    finish();
    await vi.waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /Open access/ })).toBeEnabled(),
    );
  });

  it("undoes a change that couldn't be saved and says so", async () => {
    vi.mocked(setSectionGrant).mockRejectedValue(new Error("500"));
    renderPage();
    await screen.findByText("Role visibility");

    await userEvent.click(screen.getByRole("checkbox", { name: /Data management/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save that change");
    expect(screen.getByRole("checkbox", { name: /Data management/ })).toBeChecked();
  });

  it("says so when the settings can't be loaded", async () => {
    vi.mocked(getVisibility).mockRejectedValue(new Error("403"));
    renderPage();
    expect(await screen.findByText("Could not load the visibility settings.")).toBeInTheDocument();
  });

  it("“Back to admin mode” goes to the admin page", async () => {
    renderPage();
    await screen.findByText("Role visibility");
    await userEvent.click(screen.getByRole("button", { name: "Back to admin mode" }));
    expect(screen.getByText("admin page")).toBeInTheDocument();
  });
});
