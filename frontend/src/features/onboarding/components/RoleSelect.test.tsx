import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRoles, setMyRole } from "../api";
import { RoleSelect } from "./RoleSelect";

vi.mock("../api", () => ({ getRoles: vi.fn(), setMyRole: vi.fn() }));

const roles = [
  { id: "r1", name: "Data steward" },
  { id: "r2", name: "Researcher" },
];

beforeEach(() => {
  vi.mocked(getRoles).mockReset().mockResolvedValue(roles);
  vi.mocked(setMyRole).mockReset();
});

describe("RoleSelect", () => {
  it("preselects the first role and saves the one chosen", async () => {
    const onDone = vi.fn();
    vi.mocked(setMyRole).mockResolvedValue({ role: roles[1] });
    render(<RoleSelect onDone={onDone} />);

    const select = screen.getByRole("combobox");
    expect(await screen.findByRole("option", { name: "Researcher" })).toBeInTheDocument();
    expect(select).toHaveValue("r1");

    await userEvent.selectOptions(select, "r2");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(setMyRole).toHaveBeenCalledWith("r2");
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(roles[1]));
  });

  it("starts from the learner's current role when given one", async () => {
    render(<RoleSelect onDone={vi.fn()} initialRoleId="r2" confirmLabel="Save" />);
    await screen.findByRole("option", { name: "Researcher" });
    expect(screen.getByRole("combobox")).toHaveValue("r2");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows its own heading and description", () => {
    render(<RoleSelect onDone={vi.fn()} heading="Your role" description="Change it here." />);
    expect(screen.getByRole("heading", { name: "Your role" })).toBeInTheDocument();
    expect(screen.getByText("Change it here.")).toBeInTheDocument();
  });

  it("says so when the roles can't be loaded, and can't be confirmed", async () => {
    vi.mocked(getRoles).mockRejectedValue(new Error("offline"));
    render(<RoleSelect onDone={vi.fn()} />);
    expect(await screen.findByText("Could not load roles.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("disables everything while saving, and lets the learner retry a failed save", async () => {
    let failSave!: (error: Error) => void;
    vi.mocked(setMyRole).mockReturnValue(new Promise((_, reject) => (failSave = reject)));
    const onDone = vi.fn();
    render(<RoleSelect onDone={onDone} />);
    await screen.findByRole("option", { name: "Researcher" });

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();

    failSave(new Error("500"));

    expect(await screen.findByText("Could not save your role. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
