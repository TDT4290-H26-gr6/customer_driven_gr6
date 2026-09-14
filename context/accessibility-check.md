# Keyboard accessibility check (14/09 meeting action item)

Action item from the 14/09 meeting: "Sjekke at man kan bruke tastatur" — check
that the app can be used with a keyboard alone. This is a record of that
check, done by reading through every interactive component in
`frontend/src` plus running an automated pass, rather than by a live
tab-through (do that too before the next demo — this covers the code, not
every runtime edge case).

## What was checked

- Every clickable control in the app: is it a real `<button>`, `<a>`, or
  form element (all natively keyboard-operable), or a `div`/`span` with a
  click handler and no keyboard equivalent (not operable by default)?
- Custom widgets with an ARIA role (`role="dialog"`, `role="menu"`,
  `role="radio"`, `role="progressbar"`, `role="radiogroup"`): do they behave
  the way that role promises for keyboard users?
- Focus handling: does anything trap focus without an escape route, or
  suppress the visible focus outline without a replacement?
- `eslint-plugin-jsx-a11y`'s recommended rule set was added to
  `frontend/eslint.config.js` as an automated, ongoing version of this same
  check — see "Code quality" in the root README. `npm run lint` in
  `frontend/` currently reports zero accessibility violations.

## Findings

The app was already in good shape:

- All interactive elements are native `<button>`, `<a>`, or `<select>`
  elements, or `<button role="...">` for the two custom-ARIA-role cases
  (Header's account menu items, Settings' visuals radio group) — all
  reachable by Tab and activatable with Enter/Space without extra wiring.
- `RoleGateModal` (the onboarding role picker) is a proper `role="dialog"`
  with `aria-modal`, and `AppShell` makes the rest of the page `inert`
  while it's open — so keyboard focus can't Tab out into a half-blocked
  page behind it, which is the usual way modals break keyboard use.
- `Header`'s account dropdown closes on Escape and on an outside click, so
  it doesn't trap focus either.
- No CSS anywhere sets `outline: none` (or otherwise hides the focus ring)
  without providing a replacement, so the browser's default focus
  indicator survives on every control.
- The two third-party widgets — the Google Sign-In button and the
  `<pie-fixed-player>` question widget — are outside our code; their
  keyboard behavior comes from their own upstream implementations.

## Fix made as part of this check

- Added a "Skip to main content" link (`AppShell.tsx` /
  `AppShell.module.css`): the first focusable element on every
  authenticated page, invisible until it receives keyboard focus. Lets a
  keyboard user jump straight past the header and sidebar nav into the
  page content instead of tabbing through both every time. `<main>` got a
  matching `id="main-content"` and `tabIndex={-1}` so the jump actually
  moves focus, not just the scroll position.

## Suggested follow-up (not done here)

- A live tab-through in a real browser before the next demo, since a code
  read can't catch every runtime interaction (e.g. how the PIE widget
  itself handles Tab/arrow keys once it's rendered).
- If the Settings "visuals" `radiogroup` grows more options, add
  arrow-key navigation between its radio buttons — Tab/Enter already work
  today, but the full ARIA radiogroup pattern also expects arrow keys to
  move selection.
