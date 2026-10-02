import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";
import { getProfile, saveProfile } from "../api";

vi.mock("../api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

const updateLearner = vi.fn();
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ learner: { name: "Ada Lovelace" }, updateLearner }),
}));

const savedLearner = { id: "learner-1", name: "Ada King", hasCompletedProfile: true };

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillEverythingButName(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Industry"), "Government");
  await user.selectOptions(screen.getByLabelText("Academic degree"), "Master's");
  await user.type(screen.getByLabelText(/occupation/i), "  Data steward  ");
  await user.type(screen.getByLabelText(/years of experience/i), "2");
}

describe("ProfileForm", () => {
  it("pre-fills the name from the session and the rest from the saved profile", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      industry: "higher_education",
      academicDegree: "phd",
      background: "PhD candidate in biology",
      yearsOfExperience: 4,
      goals: "Learn FAIR data",
    });

    render(<ProfileForm />);

    expect(await screen.findByDisplayValue("PhD candidate in biology")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Industry")).toHaveValue("higher_education");
    expect(screen.getByLabelText("Academic degree")).toHaveValue("phd");
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getByLabelText(/goals/i)).toHaveValue("Learn FAIR data");
  });

  it("saves every field trimmed, updates the session and calls onSaved", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(saveProfile).mockResolvedValue(savedLearner as never);
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<ProfileForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), " Ada King ");
    await fillEverythingButName(user);
    await user.type(screen.getByLabelText(/goals/i), "  Share data openly  ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith({
        name: "Ada King",
        industry: "government",
        academicDegree: "master",
        background: "Data steward",
        yearsOfExperience: 2,
        goals: "Share data openly",
      }),
    );
    expect(updateLearner).toHaveBeenCalledWith(savedLearner);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("saves without goals, as null — they're optional", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(saveProfile).mockResolvedValue(savedLearner as never);
    const user = userEvent.setup();

    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

    await fillEverythingButName(user);
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ goals: null })),
    );
  });

  it("refuses to save until every required field is filled in", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    const user = userEvent.setup();

    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/fill in every field/i)).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("refuses a name that's only spaces", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    const user = userEvent.setup();

    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "   ");
    await fillEverythingButName(user);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/fill in every field/i)).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("shows an error, and doesn't continue, when saving fails", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(saveProfile).mockRejectedValue(new Error("network error"));
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<ProfileForm onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

    await fillEverythingButName(user);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(updateLearner).not.toHaveBeenCalled();
  });
});
