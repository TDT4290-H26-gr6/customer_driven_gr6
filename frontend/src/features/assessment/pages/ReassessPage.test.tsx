import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReassessPage } from "./ReassessPage";
import { getAssessableSections, startReassessment } from "../api";

vi.mock("../api", () => ({
  getAssessableSections: vi.fn(),
  startReassessment: vi.fn(),
}));

const auth = { learner: { hasCompletedInitialAssessment: true } };
vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

const sections = [
  { id: "sec-baking", name: "Baking", description: null },
  { id: "sec-knife", name: "Knife Skills", description: null },
  { id: "sec-safety", name: "Kitchen Safety", description: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.learner.hasCompletedInitialAssessment = true;
  vi.mocked(getAssessableSections).mockResolvedValue(sections);
  vi.mocked(startReassessment).mockResolvedValue(undefined);
});

describe("ReassessPage", () => {
  it("offers the full assessment, preselected, or a single section", () => {
    render(<ReassessPage />);

    expect(screen.getByText("What would you like to retake?")).toBeInTheDocument();
    expect(screen.getByLabelText("Full assessment")).toBeChecked();
    expect(screen.getByLabelText("A single section")).not.toBeChecked();
    // The dropdown only appears once "A single section" is picked.
    expect(screen.queryByLabelText("Section")).not.toBeInTheDocument();
  });

  it("starting with the default goes straight to a normal reassessment of everything", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(navigate).toHaveBeenCalledWith("/assessment");
    expect(startReassessment).not.toHaveBeenCalled();
  });

  it("'A single section' reveals a dropdown and starts a reassessment limited to the pick", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await user.selectOptions(await screen.findByLabelText("Section"), "Knife Skills");
    await user.selectOptions(screen.getByLabelText("Section"), "Baking");
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    await waitFor(() => expect(startReassessment).toHaveBeenCalledWith(["sec-baking"]));
    expect(navigate).toHaveBeenCalledWith("/assessment", { replace: true });
  });

  it("can't start a single-section reassessment without a section", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await screen.findByLabelText("Section");

    expect(screen.getByRole("button", { name: "Start assessment" })).toBeDisabled();
  });

  it("switching back to the full assessment ignores a picked section", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await user.selectOptions(await screen.findByLabelText("Section"), "Knife Skills");
    await user.click(screen.getByLabelText("Full assessment"));
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(navigate).toHaveBeenCalledWith("/assessment");
    expect(startReassessment).not.toHaveBeenCalled();
  });

  it("resumes the assessment if one is already in progress", async () => {
    vi.mocked(startReassessment).mockRejectedValue({ status: 409, message: "in progress" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await user.selectOptions(await screen.findByLabelText("Section"), "Knife Skills");
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/assessment", { replace: true }));
  });

  it("shows an error and stays when starting fails", async () => {
    vi.mocked(startReassessment).mockRejectedValue({ status: 0, message: "offline" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await user.selectOptions(await screen.findByLabelText("Section"), "Knife Skills");
    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(await screen.findByText(/couldn't start the assessment/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers a retry when the sections fail to load", async () => {
    vi.mocked(getAssessableSections).mockRejectedValueOnce({ status: 0, message: "offline" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Section")).toBeInTheDocument();
  });

  it("can still start the full assessment when the sections fail to load", async () => {
    vi.mocked(getAssessableSections).mockRejectedValue({ status: 0, message: "offline" });
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Start assessment" }));

    expect(navigate).toHaveBeenCalledWith("/assessment");
    expect(startReassessment).not.toHaveBeenCalled();
  });

  it("says so when there are no sections to pick from", async () => {
    vi.mocked(getAssessableSections).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByLabelText("A single section"));

    expect(await screen.findByText(/no sections to pick from/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start assessment" })).toBeDisabled();
  });

  it("cancel goes back to where the learner came from", async () => {
    const user = userEvent.setup();
    render(<ReassessPage />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("sends a learner who hasn't finished a first assessment to it instead", () => {
    auth.learner.hasCompletedInitialAssessment = false;
    render(<ReassessPage />);

    expect(screen.getByText("redirected to /assessment")).toBeInTheDocument();
  });
});
