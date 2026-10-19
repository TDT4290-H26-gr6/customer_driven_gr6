import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { Header } from "./Header";

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));

const logout = vi.fn();

function renderHeader(learner: object | null) {
  vi.mocked(useAuth).mockReturnValue({ learner, logout } as never);
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Header />
      <Routes>
        <Route path="*" element={<p data-testid="page" />} />
        {["/settings", "/faq", "/admin"].map((path) => (
          <Route key={path} path={path} element={<p>{path} page</p>} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

const ada = { name: "Ada Lovelace", email: "ada@example.com", role: null, isAdmin: false };

beforeEach(() => {
  logout.mockReset();
});

describe("Header", () => {
  it("shows only the logo while signed out", () => {
    renderHeader(null);
    expect(screen.getByRole("img", { name: /AIOS/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it.each([
    [{ ...ada, name: "Ada Lovelace" }, "AL"],
    [{ ...ada, name: "Ada King Lovelace" }, "AL"],
    [{ ...ada, name: "Ada" }, "AD"],
    [{ ...ada, name: null, email: "zoe@example.com" }, "ZO"],
    [{ ...ada, name: "  ", email: "" }, "?"],
  ])("shows the learner's initials on the avatar", (learner, initials) => {
    renderHeader(learner);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent(initials);
  });

  it("opens the account menu with the learner's name and role", async () => {
    renderHeader({ ...ada, role: { id: "r1", name: "Data steward" } });
    const avatar = screen.getByRole("button", { name: "Account menu" });
    expect(avatar).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(avatar);

    expect(avatar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toHaveTextContent("Ada Lovelace");
    expect(screen.getByRole("menu")).toHaveTextContent("Data steward");
    // Admin mode is only offered to admins.
    expect(screen.queryByRole("menuitem", { name: /Admin mode/ })).not.toBeInTheDocument();
  });

  it.each([
    ["Settings", "/settings page"],
    ["FAQ", "/faq page"],
  ])("%s goes to its page and closes the menu", async (item, page) => {
    renderHeader(ada);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: new RegExp(item) }));

    expect(screen.getByText(page)).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("offers admins Admin mode", async () => {
    renderHeader({ ...ada, isAdmin: true });
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Admin mode/ }));
    expect(screen.getByText("/admin page")).toBeInTheDocument();
  });

  it("signs out", async () => {
    renderHeader(ada);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Sign out/ }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on Escape or a click outside it, but not a click inside", async () => {
    renderHeader(ada);
    const avatar = screen.getByRole("button", { name: "Account menu" });

    await userEvent.click(avatar);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(avatar);
    fireEvent.mouseDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
