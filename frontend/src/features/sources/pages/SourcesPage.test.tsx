import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourcesPage } from "./SourcesPage";
import { getSources } from "../api";

vi.mock("../api", () => ({
  getSources: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SourcesPage", () => {
  it("shows the empty message only when there really are no sources", async () => {
    vi.mocked(getSources).mockResolvedValue([]);

    render(<SourcesPage />);

    expect(await screen.findByText("No sources are available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error with a retry, not the empty message, when loading fails", async () => {
    vi.mocked(getSources)
      .mockRejectedValueOnce({ status: 0, message: "offline" })
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(<SourcesPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the sources");
    expect(screen.queryByText("No sources are available yet.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("No sources are available yet.")).toBeInTheDocument();
    expect(getSources).toHaveBeenCalledTimes(2);
  });
});
