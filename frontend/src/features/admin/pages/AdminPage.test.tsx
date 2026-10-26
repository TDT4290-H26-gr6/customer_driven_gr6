import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import { downloadQuestionsCsv, downloadTestsCsv, getDropoff, getVisibility } from "../api";
import type { DropoffData, DropoffQuestion } from "../types";

vi.mock("../api", () => ({
  getDropoff: vi.fn(),
  getVisibility: vi.fn(),
  downloadTestsCsv: vi.fn(),
  downloadQuestionsCsv: vi.fn(),
}));
const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

function question(overrides: Partial<DropoffQuestion>): DropoffQuestion {
  return {
    questionId: "q",
    text: "A question",
    questionType: "likert",
    section: { id: "s1", code: "A", name: "Foundations" },
    order: 1,
    viewedCount: 10,
    answeredCount: 10,
    droppedCount: 1,
    dropOffRate: 0.1,
    lowSample: false,
    ...overrides,
  };
}

const DATA: DropoffData = {
  summary: { started: 14, completed: 6, abandoned: 5, inProgress: 3 },
  questions: [
    question({
      questionId: "q1",
      text: "Reliable question",
      order: 1,
      dropOffRate: 0.3,
    }),
    question({
      questionId: "q2",
      text: "Tiny sample question",
      order: 2,
      viewedCount: 2,
      answeredCount: 0,
      droppedCount: 2,
      dropOffRate: 1,
      lowSample: true,
    }),
    question({
      questionId: "q3",
      text: "Another reliable",
      order: 3,
      dropOffRate: 0.5,
    }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVisibility).mockResolvedValue({
    roles: [],
    sections: [{ id: "s1", name: "Foundations", description: null }],
    competences: [],
    roleSections: [],
    roleCompetences: [],
  });
  vi.mocked(getDropoff).mockResolvedValue(DATA);
});

describe("AdminPage question drop-off", () => {
  it.each([
    ["View tester feedback", "/admin/feedback"],
    ["Exit admin mode", "/dashboard"],
  ])("“%s” goes to %s", async (button, destination) => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText("Started");

    expect(screen.getByRole("heading", { name: "Admin mode" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: button }));

    expect(navigate).toHaveBeenCalledWith(destination);
  });

  it("shows the summary cards and loads with the default filters", async () => {
    render(<AdminPage />);

    const started = await screen.findByText("Started");
    expect(started.previousElementSibling).toHaveTextContent("14");
    expect(screen.getByText("In progress").previousElementSibling).toHaveTextContent("3");
    expect(getDropoff).toHaveBeenCalledWith({
      type: "initial",
      sectionId: "",
      from: "",
      to: "",
      inactiveDays: 7,
    });
  });

  it("ranks reliable rows by rate, low-sample rows last and badged", async () => {
    render(<AdminPage />);
    await screen.findByText("Started");

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Another reliable",
      "Reliable question",
      "Tiny sample questionlow sample",
    ]);
  });

  it("shows how many were shown each question, and how many answered it", async () => {
    render(<AdminPage />);
    await screen.findByText("Started");

    expect(screen.getByRole("columnheader", { name: /Viewed/ })).toBeInTheDocument();
    const tiny = within(screen.getByRole("table"))
      .getByText("Tiny sample question", { exact: false })
      .closest("tr")!;
    const cells = within(tiny).getAllByRole("cell");
    // Viewed 2, answered 0: shown the question, nobody answered it.
    expect(cells.slice(3).map((c) => c.textContent)).toEqual(["2", "0", "2", "100.0%"]);
  });

  it("sorts by a clicked column", async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText("Started");

    await user.click(screen.getByRole("button", { name: "Answered" }));
    await user.click(screen.getByRole("button", { name: /Answered/ })); // desc -> asc

    const firstRow = screen.getAllByRole("row")[1];
    expect(within(firstRow).getByText("Tiny sample question", { exact: false })).toBeVisible();
  });

  it("refetches when a filter changes", async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText("Started");

    await user.selectOptions(screen.getByLabelText("Assessment"), "targeted_reevaluation");
    await waitFor(() =>
      expect(getDropoff).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "targeted_reevaluation" }),
      ),
    );
  });

  it("shows the empty state when nothing was abandoned", async () => {
    vi.mocked(getDropoff).mockResolvedValue({
      summary: { started: 2, completed: 2, abandoned: 0, inProgress: 0 },
      questions: [],
    });
    render(<AdminPage />);

    expect(await screen.findByText("No abandoned instances in this period.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("clears the date range with one button, which only shows while a date is set", async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText("Started");
    expect(screen.queryByRole("button", { name: "Clear dates" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Started from"), "2026-10-01");
    await user.type(screen.getByLabelText("Started until"), "2026-10-31");
    await waitFor(() =>
      expect(getDropoff).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-10-01", to: "2026-10-31" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Clear dates" }));

    expect(screen.getByLabelText("Started from")).toHaveValue("");
    expect(screen.getByLabelText("Started until")).toHaveValue("");
    await waitFor(() =>
      expect(getDropoff).toHaveBeenLastCalledWith(expect.objectContaining({ from: "", to: "" })),
    );
    expect(screen.queryByRole("button", { name: "Clear dates" })).not.toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    vi.mocked(getDropoff).mockRejectedValue(new Error("boom"));
    render(<AdminPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the drop-off data.");
  });

  it("does not fetch for an invalid inactivity window", async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText("Started");
    vi.mocked(getDropoff).mockClear();

    await user.clear(screen.getByLabelText("Inactive after (days)"));

    expect(await screen.findByRole("alert")).toHaveTextContent("whole number of days");
    expect(getDropoff).not.toHaveBeenCalled();
  });
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
