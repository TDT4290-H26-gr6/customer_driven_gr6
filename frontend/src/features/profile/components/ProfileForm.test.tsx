import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";
import { getProfile, saveProfile } from "../api";

vi.mock("../api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileForm", () => {
  it("pre-fills the fields from an existing profile", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      goals: "Learn FAIR data",
      background: "Biology PhD",
      yearsOfExperience: 4,
    });

    render(<ProfileForm />);

    expect(await screen.findByDisplayValue("Learn FAIR data")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Biology PhD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  it("starts with empty fields when there's no profile yet", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);

    render(<ProfileForm />);

    await waitFor(() => expect(getProfile).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText(/what are you hoping/i)).toHaveValue("");
  });

  it("saves trimmed text and a parsed number, converting blanks to null", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(saveProfile).mockResolvedValue({
      goals: "Grow as a researcher",
      background: null,
      yearsOfExperience: 2,
    });
    const user = userEvent.setup();

    render(<ProfileForm />);
    await waitFor(() => expect(getProfile).toHaveBeenCalledOnce());

    await user.type(
      screen.getByPlaceholderText(/what are you hoping/i),
      "  Grow as a researcher  ",
    );
    await user.type(screen.getByLabelText(/years of experience/i), "2");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith({
        goals: "Grow as a researcher",
        background: null,
        yearsOfExperience: 2,
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("shows an error and no confirmation when saving fails", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(saveProfile).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    render(<ProfileForm />);
    await waitFor(() => expect(getProfile).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
  });
});
