import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}, path = "/dashboard") {
  const onToggleCollapsed = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar collapsed={false} onToggleCollapsed={onToggleCollapsed} {...props} />
    </MemoryRouter>,
  );
  return { onToggleCollapsed, nav: screen.getByRole("navigation", { name: "Main" }) };
}

describe("Sidebar", () => {
  it("links to every page, FAQ included, on desktop", () => {
    const { nav } = renderSidebar();
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Competencies",
      "Journeys",
      "History",
      "FAQ",
    ]);
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute("href", "/history");
  });

  it("marks the current page's link", () => {
    const { nav } = renderSidebar({}, "/journeys");
    expect(within(nav).getByRole("link", { name: "Journeys" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("collapsed: icons only, with the label as a tooltip", () => {
    const { nav } = renderSidebar({ collapsed: true });
    const dashboard = within(nav).getAllByRole("link")[0];
    expect(dashboard).toHaveTextContent("");
    expect(dashboard).toHaveAttribute("title", "Dashboard");
  });

  it("toggles its labels", async () => {
    const { onToggleCollapsed } = renderSidebar({ collapsed: true });
    const toggle = screen.getByRole("button", { name: "Show labels" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("offers to hide the labels while they show", () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByRole("button", { name: "Hide labels" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("as the mobile bottom bar: four tabs with labels, no FAQ and no collapse control", () => {
    // `collapsed` is a desktop preference and must not hide the bottom bar's labels.
    const { nav } = renderSidebar({ layout: "bottom", collapsed: true });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Competencies", "Journeys", "History"]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
