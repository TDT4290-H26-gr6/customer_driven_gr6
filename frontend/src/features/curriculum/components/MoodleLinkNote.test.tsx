import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoodleLinkNote } from "./MoodleLinkNote";

describe("MoodleLinkNote", () => {
  it("links to a Moodle page", () => {
    render(<MoodleLinkNote url="https://moodle.example.org/course/view.php?id=1" />);
    expect(screen.getByRole("link", { name: "Moodle page" })).toHaveAttribute(
      "href",
      "https://moodle.example.org/course/view.php?id=1",
    );
  });

  it.each(["javascript:alert(1)", "moodle.example.org/course"])(
    "warns about %s instead of linking to it",
    (url) => {
      render(<MoodleLinkNote url={url} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(/isn't a web address/)).toBeInTheDocument();
    },
  );

  it("shows nothing without a link", () => {
    const { container } = render(<MoodleLinkNote url={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
