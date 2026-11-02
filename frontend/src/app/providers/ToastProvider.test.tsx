import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

function ShowButtons() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast({ title: "First" })}>first</button>
      <button onClick={() => showToast({ title: "Second" })}>second</button>
    </>
  );
}

describe("ToastProvider", () => {
  it("shows one toast at a time, a newer one replacing it", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ShowButtons />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "first" }));
    expect(screen.getByRole("status")).toHaveTextContent("First");

    await user.click(screen.getByRole("button", { name: "second" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Second");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does nothing outside the provider", async () => {
    const user = userEvent.setup();
    render(<ShowButtons />);
    await user.click(screen.getByRole("button", { name: "first" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
