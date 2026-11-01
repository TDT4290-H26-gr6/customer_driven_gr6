/**
 * Whether `url` is a web address (http or https) that's safe to link to.
 * Links shown to learners come from the curriculum (the editor only accepts
 * https ones, but the dataset is loaded as it is), and an `href` that is a
 * `javascript:` or `data:` address would run code when clicked. Anything
 * else isn't shown as a link at all.
 */
export function isWebLink(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
