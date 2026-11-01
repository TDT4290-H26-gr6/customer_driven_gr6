import { describe, expect, it } from "vitest";
import { isWebLink } from "./webLink";

describe("isWebLink", () => {
  it.each(["https://moodle.example.org/course/view.php?id=3", "http://localhost:8080/x"])(
    "accepts the web address %s",
    (url) => expect(isWebLink(url)).toBe(true),
  );

  it.each([
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example.org",
    "/relative/path",
    "not a url",
    "",
    null,
    undefined,
  ])("rejects %j", (url) => expect(isWebLink(url)).toBe(false));
});
