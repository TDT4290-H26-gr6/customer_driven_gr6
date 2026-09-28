/**
 * The one mobile/desktop split. Phones and small tablets in portrait are
 * "mobile" (bottom tab bar, single column); everything wider is "desktop".
 *
 * CSS Modules can't read this — media queries can't use custom properties —
 * so every `@media (max-width: 767px)` in a `.module.css` must be kept in
 * sync with it by hand. Grep for `767px` before changing.
 */
export const MOBILE_MAX_WIDTH = 767;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;
