import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import {
  downloadQuestionsCsv,
  downloadTestsCsv,
  getVisibility,
  setCompetenceGrant,
  setSectionGrant,
} from "../api";
import type { VisibilityMatrix } from "../types";

vi.mock("../api", () => ({
  getVisibility: vi.fn(),
  setSectionGrant: vi.fn(),
  setCompetenceGrant: vi.fn(),
  downloadTestsCsv: vi.fn(),
  downloadQuestionsCsv: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const MATRIX: VisibilityMatrix = {
  roles: [{ id: "role-1", name: "Administrator" }],
  sections: [],
  competences: [],
  roleSections: [],
  roleCompetences: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVisibility).mockResolvedValue(MATRIX);
  // Unused in these tests, but AdminPage's module-level import needs them defined.
  vi.mocked(setSectionGrant).mockResolvedValue(undefined);
  vi.mocked(setCompetenceGrant).mockResolvedValue(undefined);
});

describe("AdminPage downloads", () => {
  it("downloads the tests CSV and shows 'Downloading…' meanwhile", async () => {
    let resolveDownload!: () => void;
    vi.mocked(downloadTestsCsv).mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText("Admin mode");

    const button = screen.getByRole("button", { name: /download test stats/i });
    await user.click(button);

    expect(await screen.findByRole("button", { name: /downloading/i })).toBeInTheDocument();
    resolveDownload();
    await waitFor(() => expect(downloadTestsCsv).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: /download test stats/i })).toBeEnabled();
  });

  it("downloads the questions CSV independently of the tests one", async () => {
    vi.mocked(downloadQuestionsCsv).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText("Admin mode");

    await user.click(screen.getByRole("button", { name: /download question stats/i }));

    await waitFor(() => expect(downloadQuestionsCsv).toHaveBeenCalledOnce());
    expect(downloadTestsCsv).not.toHaveBeenCalled();
  });

  it("shows an error, not a crash, when the download fails", async () => {
    vi.mocked(downloadTestsCsv).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText("Admin mode");

    await user.click(screen.getByRole("button", { name: /download test stats/i }));

    expect(await screen.findByText(/could not download/i)).toBeInTheDocument();
  });
});
