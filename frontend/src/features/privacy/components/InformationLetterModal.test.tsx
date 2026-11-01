import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InformationLetterLink } from "./InformationLetterLink";
import { InformationLetterModal } from "./InformationLetterModal";

describe("InformationLetterModal", () => {
  it("shows the letter with its sections", () => {
    render(<InformationLetterModal onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Information letter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your rights" })).toBeInTheDocument();
    expect(screen.getByText(/NTNU is responsible/)).toBeInTheDocument();
  });

  it("puts focus on the close button", () => {
    render(<InformationLetterModal onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close information letter" })).toHaveFocus();
  });

  it("closes with the X, with Escape and with a click outside it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InformationLetterModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close information letter" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("presentation"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("stays open when the letter itself is clicked", async () => {
    const onClose = vi.fn();
    render(<InformationLetterModal onClose={onClose} />);

    await userEvent.click(screen.getByText(/NTNU is responsible/));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<InformationLetterModal onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close information letter" });
    const rightsLink = screen.getByRole("link");

    // Close button is first, the rights link last: Tab from the link wraps round.
    rightsLink.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(rightsLink).toHaveFocus();
  });
});

describe("InformationLetterLink", () => {
  it("opens the letter, and gives focus back to the link when it is closed", async () => {
    const user = userEvent.setup();
    render(<InformationLetterLink>information letter</InformationLetterLink>);
    const trigger = screen.getByRole("button", { name: "information letter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Information letter" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
