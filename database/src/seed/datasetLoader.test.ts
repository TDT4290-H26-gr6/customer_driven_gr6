import { describe, expect, it, vi } from "vitest";
import { moodleLink, withMoodleLink } from "./datasetLoader";

vi.mock("../db/prisma", () => ({ prisma: {} }));

const BASE = "https://moodle.test";

describe("moodleLink", () => {
  it("builds a course link from the base URL and the row's moodleCourseId", () => {
    expect(moodleLink({ moodleCourseId: 1002 }, BASE)).toBe(
      "https://moodle.test/course/view.php?id=1002",
    );
  });

  it("prefers a full moodleUrl when the row gives one", () => {
    expect(
      moodleLink(
        { moodleCourseId: 1002, moodleUrl: "https://moodle.ntnu.no/mod/page/view.php?id=7" },
        BASE,
      ),
    ).toBe("https://moodle.ntnu.no/mod/page/view.php?id=7");
  });

  it("is null when the row names no Moodle page", () => {
    expect(moodleLink({}, BASE)).toBeNull();
    expect(moodleLink({ moodleCourseId: null, moodleUrl: "" }, BASE)).toBeNull();
  });
});

describe("withMoodleLink", () => {
  it("builds a module's moodleUrl and drops the authoring-only course id", () => {
    const row = withMoodleLink({ id: "mod-a2", moodleCourseId: 1002 }, "moodleUrl");
    expect(row).toEqual({
      id: "mod-a2",
      moodleUrl: "https://moodle.example.org/course/view.php?id=1002",
    });
  });

  it("keeps a partner source's own web page instead of making it a Moodle link", () => {
    const row = withMoodleLink(
      { id: "src-unibo", sourceUrl: "https://www.unibo.it/en/research/open-science" },
      "sourceUrl",
    );
    expect(row).toEqual({
      id: "src-unibo",
      sourceUrl: "https://www.unibo.it/en/research/open-science",
    });
  });

  it("builds a source's link from its Moodle course id when it has no page of its own", () => {
    const row = withMoodleLink({ id: "src-fake", moodleCourseId: 101 }, "sourceUrl");
    expect(row.sourceUrl).toBe("https://moodle.example.org/course/view.php?id=101");
    expect(row).not.toHaveProperty("moodleCourseId");
  });

  it.each([
    ["javascript:alert(1)", "moodleUrl"],
    ["data:text/html,<script>alert(1)</script>", "sourceUrl"],
    ["moodle.example.org/course/view.php?id=1", "moodleUrl"],
  ] as const)("refuses %s, which isn't a web address, naming the row", (link, key) => {
    expect(() => withMoodleLink({ id: "mod-bad", [key]: link }, key)).toThrow(
      /mod-bad: .* isn't a web address/,
    );
  });

  it("leaves a row without a link as it is", () => {
    expect(withMoodleLink({ id: "lj-1" }, "moodleUrl")).toEqual({ id: "lj-1", moodleUrl: null });
  });
});
