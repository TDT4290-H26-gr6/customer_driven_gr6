import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReassessPage } from "./ReassessPage";
import { getAssessableSections, startReassessment } from "../api";
import { listJourneys } from "@/features/learningJourney";

vi.mock("../api", () => ({
  getAssessableSections: vi.fn(),
  startReassessment: vi.fn(),
}));

vi.mock("@/features/learningJourney", () => ({ listJourneys: vi.fn() }));

const auth = { learner: { hasCompletedInitialAssessment: true } };
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

const journeys = [
  {
    id: "journey-knife",
    name: "Knife Ninja",
    description: null,
    modules: [],
    sections: [{ sectionId: "sec-knife" }, { sectionId: "sec-safety" }],
  },
];
const sections = [
  { id: "sec-baking", name: "Baking", description: null },
  { id: "sec-knife", name: "Knife Skills", description: null },
  { id: "sec-safety", name: "Kitchen Safety", description: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.learner.hasCompletedInitialAssessment = true;
  vi.mocked(listJourneys).mockResolvedValue(journeys);
  vi.mocked(getAssessableSections).mockResolvedValue(sections);
  vi.mocked(startReassessment).mockResolvedValue(undefined);
});

describe("ReassessPage", () => {
  it("'No' goes straight to a normal reassessment of everything", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "No" }));

    expect(navigate).toHaveBeenCalledWith("/assessment");
    expect(startReassessment).not.toHaveBeenCalled();
  });

  it("'Yes' pre-ticks the chosen journey's sections and starts a reassessment limited to them", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.selectOptions(await screen.findByLabelText("Learning journey"), "Knife Ninja");

    expect(screen.getByLabelText("Knife Skills")).toBeChecked();
    expect(screen.getByLabelText("Kitchen Safety")).toBeChecked();
    expect(screen.getByLabelText("Baking")).not.toBeChecked();

    // The learner can adjust the selection.
    await user.click(screen.getByLabelText("Kitchen Safety"));
    await user.click(screen.getByLabelText("Baking"));
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    await waitFor(() =>
      expect(startReassessment).toHaveBeenCalledWith("journey-knife", ["sec-knife", "sec-baking"]),
    );
    expect(navigate).toHaveBeenCalledWith("/assessment", { replace: true });
  });

  it("can't start without a journey and at least one section", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await screen.findByLabelText("Learning journey");
    expect(screen.getByRole("button", { name: "Start assessment" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Learning journey"), "Knife Ninja");
    await user.click(screen.getByLabelText("Knife Skills"));
    await user.click(screen.getByLabelText("Kitchen Safety"));

    expect(screen.getByRole("button", { name: "Start assessment" })).toBeDisabled();
  });

  it("resumes the assessment if one is already in progress", async () => {
    vi.mocked(startReassessment).mockRejectedValue({ status: 409, message: "in progress" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.selectOptions(await screen.findByLabelText("Learning journey"), "Knife Ninja");
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/assessment", { replace: true }));
  });

  it("shows an error and stays when starting fails", async () => {
    vi.mocked(startReassessment).mockRejectedValue({ status: 0, message: "offline" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.selectOptions(await screen.findByLabelText("Learning journey"), "Knife Ninja");
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(await screen.findByText(/couldn't start the reassessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers a retry when the journeys fail to load", async () => {
    vi.mocked(listJourneys).mockRejectedValueOnce({ status: 0, message: "offline" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Learning journey")).toBeInTheDocument();
  });

  it("offers a full reassessment when there are no journeys at all", async () => {
    vi.mocked(listJourneys).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.click(await screen.findByRole("button", { name: "Reassess everything instead" }));

    expect(navigate).toHaveBeenCalledWith("/assessment");
    expect(startReassessment).not.toHaveBeenCalled();
  });

  it("sends a learner who hasn't finished a first assessment to it instead", () => {
    auth.learner.hasCompletedInitialAssessment = false;
    render(<ReassessPage />);

    expect(screen.getByText("redirected to /assessment")).toBeInTheDocument();
  });
});
