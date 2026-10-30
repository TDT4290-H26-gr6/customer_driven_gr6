/**
 * The site is in English, so dates and numbers are formatted in English too ,
 * not in the browser's language (which would give e.g. "3. okt. 2026" or
 * "2,5" on a Norwegian browser). British English: day before month.
 */
export const APP_LOCALE = "en-GB";

/** A date like "3 Oct 2026". */
export const DATE_FORMAT = new Intl.DateTimeFormat(APP_LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
});
