import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";
import { acceptPrivacyNotice } from "@/features/auth";
import { getProfile, saveProfile } from "../api";

vi.mock("../api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ acceptPrivacyNotice: vi.fn() }));

const updateLearner = vi.fn();
const session = vi.hoisted(() => ({
  learner: { name: "Ada Lovelace" } as Record<string, unknown>,
}));
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ learner: session.learner, updateLearner }),
}));

const savedLearner = { id: "learner-1", name: "Ada King", hasCompletedProfile: true };

beforeEach(() => {
  vi.clearAllMocks();
  session.learner = { name: "Ada Lovelace" };
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
  describe("information letter consent (first-time profile step)", () => {
    async function renderConsentForm() {
      vi.mocked(getProfile).mockResolvedValue(null);
      vi.mocked(saveProfile).mockResolvedValue(savedLearner as never);
      vi.mocked(acceptPrivacyNotice).mockResolvedValue({} as never);
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <ProfileForm requireConsent submitLabel="Done" />
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
      await fillEverythingButName(user);
      return user;
    }

    it("keeps Done disabled until the information letter is acknowledged", async () => {
      const user = await renderConsentForm();
      const done = screen.getByRole("button", { name: "Done" });
      expect(done).toBeDisabled();
      expect(screen.getByRole("button", { name: "information letter" })).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox"));
      expect(done).toBeEnabled();
    });

    it("opens the letter in a modal without touching what was typed", async () => {
      const user = await renderConsentForm();

      await user.click(screen.getByRole("button", { name: "information letter" }));
      expect(screen.getByRole("dialog", { name: "Information letter" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close information letter" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/occupation/i)).toHaveValue("  Data steward  ");
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("records the acceptance, then saves the profile", async () => {
      const user = await renderConsentForm();

      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Done" }));

      await waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
      expect(acceptPrivacyNotice).toHaveBeenCalledOnce();
      expect(vi.mocked(acceptPrivacyNotice).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(saveProfile).mock.invocationCallOrder[0],
      );
    });

    it("saves nothing when recording the acceptance fails", async () => {
      const user = await renderConsentForm();
      vi.mocked(acceptPrivacyNotice).mockRejectedValue(new Error("network"));

      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Done" }));

      expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
      expect(saveProfile).not.toHaveBeenCalled();
    });

    it("doesn't ask again from someone who has already accepted", async () => {
      session.learner = { name: "Ada Lovelace", hasAcceptedPrivacyNotice: true };
      vi.mocked(getProfile).mockResolvedValue(null);
      render(
        <MemoryRouter>
          <ProfileForm requireConsent submitLabel="Done" />
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("has no checkbox where it isn't required (Settings)", async () => {
      vi.mocked(getProfile).mockResolvedValue(null);
      render(<ProfileForm />);
      await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(acceptPrivacyNotice).not.toHaveBeenCalled();
    });
  });
});
