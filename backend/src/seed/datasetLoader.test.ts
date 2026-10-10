import { describe, expect, it, vi } from "vitest";
import { moodleLink } from "./datasetLoader";

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
