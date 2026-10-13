# Frontend file structure — agreed convention

- **Date:** 2026-09-09
- **Applies to:** `frontend/` (React 18 + TypeScript + Vite)
- **Related ticket:** CD-47 — _Create a better code structure for the React project_

This document records the structure the group has agreed to use for the
React frontend of the AIOS self‑assessment questionnaire app (users self‑assess
their own AI / open‑science capabilities). New code goes in this layout; the
current flat `src/` files are migrated over incrementally (see _Migration_ below).

---

## 1. Principles we agreed on

1. **Feature‑first, not type‑first.** Group files by the product capability they
   serve (`auth`, `onboarding`, `assessment`, `results`), not by technical kind
   (`components/`, `hooks/`, `services/` at the top level). A feature folder is
   the unit we reason about, review, and hand off.
2. **Features are islands.** A feature never imports from another feature's
   internals. Cross‑feature sharing goes through `shared/` or through a feature's
   public barrel (`features/x/index.ts`).
3. **No `fetch` in components.** All network access goes through a feature's
   `api.ts`, which uses the single `shared/api/client.ts`.
4. **Co‑locate.** Types, hooks, tests and styles live next to the code they
   belong to. Only genuinely generic things move to `shared/`.
5. **`App.tsx` is a shell.** Routing + provider composition only — no data
   fetching, no business logic.
6. **Keep it boring.** We add a dependency (router, query cache, styling lib)
   only when a concrete need is agreed in a ticket.

---

## 2. Directory layout

```
frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .env.example                 # documents every VITE_* variable the app reads
├── public/                      # static assets copied as-is: favicon.png (tab icon).
│                                 # The header/login wordmark is NOT here — it's inlined SVG,
│                                 # see shared/components/Logo.tsx below.
└── src/
    ├── main.tsx                 # React entry: mounts <App/> inside providers
    ├── App.tsx                  # router + layout shell ONLY
    ├── routes.tsx               # route table (path -> page component)
    │
    ├── app/                     # app-wide wiring, not tied to one feature
    │   ├── providers/
    │   │   ├── AppProviders.tsx     # composes all context providers
    │   │   └── AuthProvider.tsx     # session/token state + refresh
    │   ├── layout/
    │   │   ├── AppShell.tsx         # header + sidebar + <Outlet/>, blocks with RoleGateModal if no role
    │   │   ├── Header.tsx           # sidebar toggle (centred above the rail's icon column) + <Logo/> left, account menu right
    │   │   ├── Sidebar.tsx          # collapsible left rail (desktop) / fixed bottom tab bar (mobile)
    │   │   └── RoleGateModal.tsx    # forced role-pick modal — see "Role gating" below
    │   └── guards/
    │       └── RequireAuth.tsx      # no session -> redirect /login
    │
    ├── features/
    │   ├── auth/
    │   │   ├── components/
    │   │   │   └── GoogleLoginButton.tsx
    │   │   ├── pages/
    │   │   │   └── LoginPage.tsx
    │   │   ├── api.ts               # POST /auth/google, GET /auth/me
    │   │   ├── hooks.ts             # useAuth(), useCurrentUser()
    │   │   ├── session.ts           # localStorage token read/write/clear
    │   │   ├── types.ts             # Learner, Session
    │   │   └── index.ts             # public surface of the feature
    │   │
    │   ├── onboarding/              # persona / role selection
    │   │   ├── components/
    │   │   │   └── RoleSelect.tsx       # dropdown + confirm button; used by both
    │   │   │                            # RoleGateModal (forced pick) and Settings (change it)
    │   │   ├── api.ts               # GET /roles, PUT /auth/me/role
    │   │   ├── hooks.ts             # useRoles(), useSetRole()
    │   │   ├── types.ts             # Role
    │   │   └── index.ts
    │   │
    │   ├── assessment/             # the questionnaire runner (the core feature)
    │   │   ├── components/
    │   │   │   ├── PieQuestionPlayer.tsx    # wraps <pie-fixed-player> web component
    │   │   │   ├── QuestionCard.tsx         # prompt + player + per-question state
    │   │   │   ├── AssessmentProgress.tsx   # "3 / 18 answered"
    │   │   │   └── AssessmentNav.tsx        # prev / next / submit
    │   │   ├── pages/
    │   │   │   ├── AssessmentIntroPage.tsx
    │   │   │   ├── AssessmentRunnerPage.tsx
    │   │   │   └── AssessmentCompletePage.tsx
    │   │   ├── api.ts               # GET /questions, POST /sat-instances, POST /responses
    │   │   ├── hooks.ts             # useAssessment(), useSaveResponse()
    │   │   ├── pie.ts               # map our Question <-> PIE config; read PIE sessions
    │   │   ├── types.ts             # Question, PieContent, Response, SatInstance
    │   │   └── index.ts
    │   │
    │   ├── sources/                # partner-institution courses/resources
    │   │   ├── components/
    │   │   │   └── SourceCard.tsx        # expandable stat-card, always shows the source link
    │   │   ├── pages/
    │   │   │   └── SourcesPage.tsx
    │   │   ├── api.ts               # GET /sources
    │   │   ├── types.ts             # Source
    │   │   └── index.ts
    │   │
    │   ├── results/                # scores + visualisation
    │   │   ├── components/
    │   │   │   ├── CompetenceRadar.tsx      # radar / spider chart (inline SVG); `compact` on mobile
    │   │   │   ├── CompetenceBreakdown.tsx
    │   │   │   ├── ScoreTable.tsx
    │   │   │   └── WelcomeScreen.tsx         # first-run state: no assessment taken yet
    │   │   ├── pages/
    │   │   │   ├── ResultsPage.tsx          # overview: one radar axis per section (sectionAxes.ts)
    │   │   │   └── SectionDetailsPage.tsx   # "More details": one radar per section, its own competences
    │   │   ├── api.ts               # GET /competence-scores/by-section
    │   │   ├── sectionAxes.ts       # rolls each section's competences into one overview axis
    │   │   ├── hooks.ts             # useResults()
    │   │   ├── types.ts             # CompetenceScore, SectionCompetenceScores
    │   │   └── index.ts
    │   │
    │   ├── learningJourney/        # every journey, plus the ones recommended on the dashboard
    │   │   ├── components/
    │   │   │   ├── JourneyCard.tsx         # expandable card on the journeys page, styled like SourceCard
    │   │   │   ├── RecommendedJourneys.tsx
    │   │   │   └── WeakCompetencesSection.tsx
    │   │   ├── pages/
    │   │   │   └── LearningJourneysPage.tsx
    │   │   ├── api.ts               # GET /learning-journeys/recommendation
    │   │   ├── types.ts             # LearningJourney, LearningJourneyModule
    │   │   └── index.ts
    │   │
    │   ├── admin/                  # admin mode: which sections/competences each role may see
    │   │   ├── components/
    │   │   │   └── GrantChecklist.tsx   # one card of checkboxes — the selected role's grants
    │   │   ├── pages/
    │   │   │   └── AdminPage.tsx        # role picker + Sections / Competences checklists
    │   │   ├── api.ts               # GET /admin/visibility, PUT/DELETE grants
    │   │   ├── types.ts             # VisibilityMatrix, Grantable
    │   │   └── index.ts
    │   │
    │   └── settings/                # account settings — role change for now, more later
    │       ├── pages/
    │       │   └── SettingsPage.tsx     # reuses onboarding's RoleSelect via its barrel
    │       └── index.ts
    │
    ├── shared/                     # generic, domain-agnostic building blocks
    │   ├── api/
    │   │   ├── client.ts           # fetch wrapper: base URL, auth header, error shape
    │   │   └── endpoints.ts        # constants for every backend path
    │   ├── components/             # presentational, reusable, no feature knowledge
    │   │   ├── Button.tsx
    │   │   ├── Select.tsx
    │   │   ├── Card.tsx
    │   │   ├── Spinner.tsx
    │   │   ├── ErrorBanner.tsx
    │   │   ├── icons.tsx           # small inline SVG icon set (incl. SidebarToggleIcon)
    │   │   └── Logo.tsx            # the AIOS wordmark as inline SVG — see "Logo" below
    │   ├── hooks/
    │   │   ├── useAsync.ts
    │   │   ├── useLocalStorage.ts
    │   │   ├── useMediaQuery.ts       # live window.matchMedia — only for when the DOM/props differ on mobile
    │   │   └── useSessionStorage.ts   # like useLocalStorage, but cleared when the tab/session ends
    │   ├── lib/
    │   │   ├── breakpoints.ts         # MOBILE_QUERY — the single mobile/desktop split (see "Responsive")
    │   │   └── format.ts
    │   └── types/
    │       └── common.ts           # ApiError, Nullable, etc.
    │
    ├── config/
    │   └── env.ts                  # reads + validates import.meta.env once
    │
    ├── styles/
    │   ├── globals.css
    │   └── theme.ts                # colour tokens, spacing scale
    │
    └── types/
        └── pie-fixed-player.d.ts   # JSX intrinsic decl for the PIE web component
```

---

## 3. Layer responsibilities

| Layer           | May import from                             | Must not import from                |
| --------------- | ------------------------------------------- | ----------------------------------- |
| `shared/`       | `shared/`, `config/`                        | `features/`, `app/`                 |
| `features/<x>/` | its own folder, `shared/`, `config/`        | other `features/`, `app/`           |
| `app/`          | `features/*/index.ts`, `shared/`, `config/` | feature internals (only the barrel) |

**Exception:** a page may import a hook directly from `app/providers/` (`useAuth`, `useTheme`) even though that's technically "`app/`". These providers hold genuinely app-wide state — the current session, the visuals setting — not feature-specific logic, so treat them like `shared/`: any feature may depend on the hook, but never reach into a provider's other internals.
| `App.tsx` / `routes.tsx` | `app/`, `features/*/index.ts` | anything deep |

A **page** owns data loading and composition for one screen. A **component**
is given everything it needs via props and stays reusable. A feature's
`index.ts` re‑exports only what the rest of the app is allowed to touch
(usually its pages and a hook or two).

---

## 4. Conventions

- **Files:** components `PascalCase.tsx`; everything else `camelCase.ts`.
  One React component per file, named the same as the file.
- **Hooks:** `useThing`, in `hooks.ts` (or `hooks/useThing.ts` once a feature
  has several).
- **Types:** co‑located in the feature's `types.ts`. Only truly shared shapes
  go in `shared/types/`. Prefer `type` aliases; avoid `any` (the current
  `Question.content: any` becomes `PieContent`).
- **Barrels:** every feature has `index.ts`. No barrel files anywhere else —
  they hurt tree‑shaking and cause import cycles.
- **Path alias:** `@/` → `src/`. Configured in both `tsconfig.json`
  (`compilerOptions.paths`) and `vite.config.ts` (`resolve.alias`). Import as
  `@/shared/...` and `@/features/auth`, never `../../../shared`.
- **Env:** read only through `@/config/env.ts`. Nothing else touches
  `import.meta.env`. All frontend vars are prefixed `VITE_` and listed in
  `frontend/.env.example`.

---

## 5. Data / API layer

- `shared/api/client.ts` is the only place that calls `fetch`. It:
  - prefixes `env.API_URL`,
  - attaches `Authorization: Bearer <token>` from `features/auth/session.ts`,
  - parses JSON and normalises errors to a single `ApiError` type,
  - clears the session and bounces to `/login` on `401`.
- `shared/api/endpoints.ts` holds the path constants so a backend rename is a
  one‑line change.
- Each feature's `api.ts` exposes typed functions (`getRoles(): Promise<Role[]>`)
  that call the client. Components/pages call the feature hooks, not `api.ts`
  directly.

---

## 6. State management

- **Server state:** feature hooks built on `shared/hooks/useAsync.ts` for now.
  If cache invalidation / refetch coordination gets painful we adopt TanStack
  Query — that is a separate ticket, not a silent addition.
- **Session/auth:** `AuthProvider` (React context) — current learner, token,
  `login`, `logout`, `setRole`. Consumed via `useAuth()`.
- **Everything else:** local `useState` in the owning page. No global store.

---

## 7. Routing & flow

`react-router-dom` drives page‑level navigation. The agreed flow:

```
/login        -> LoginPage        (public)
/settings     -> SettingsPage     (RequireAuth) — reached from the header's account dropdown
/results      -> ResultsPage      (RequireAuth)
/sources      -> SourcesPage      (RequireAuth)
/admin        -> AdminPage        (RequireAuth) — admin mode, reached from the header's account dropdown
/assessment   -> AssessmentRunnerPage (RequireAuth) — not in the sidebar; only reached via
                                        the dashboard's "Assess yourself" button
/             -> redirect to /login or /results based on session
```

`RequireAuth` (in `app/guards/`) is the only route guard. There is no
`/onboarding` route and no `RequireRole` guard — see "Role gating" below for
why picking a role is a modal, not a page or a redirect target.

### Role gating

A learner with no role yet must pick one before touching anything else,
but as a **modal**, not a separate page — the same page (e.g. `/results`)
stays mounted underneath, blocked:

- `AppShell` computes `needsRole = learner && !learner.role`. While true, it
  renders `RoleGateModal` on top and skips rendering `<Outlet/>` entirely
  (so the routed page doesn't mount — and doesn't fetch — until a role
  exists; once it does, the page mounts fresh with no stale pre-role state
  to clean up).
- `AppShell` also sets the DOM `inert` property on everything else (header,
  sidebar, the empty main area) while the modal is up. `inert` blocks clicks
  _and_ removes those elements from the tab order, so there's no
  keyboard-only escape route around the modal either. The modal itself has
  no close button, no backdrop-click-to-dismiss, and no Escape handling.
- **This client-side blocking is UX, not the security boundary.** A learner
  with dev tools can always edit their own client-side state (call
  `setRole` from the console, delete the overlay from the DOM, etc.) — no
  amount of frontend hardening changes that for a browser they control. The
  actual enforcement is server-side: `requireRole` middleware (see
  `context/backend-structure.md`) sits on every endpoint that assumes a
  persona (`GET /questions`, `GET /sources`) and returns 403 regardless of
  what the page renders. Add it to any new endpoint that shouldn't work
  before onboarding.

### Admin mode

Reached from the account menu ("Admin mode", next to Settings) and left with the
"Exit admin mode" button — it is a route (`/admin`), not a hidden app state. The
page (`features/admin`) picks a role and shows two checklists, Sections and
Competences; each tick is a `PUT` / `DELETE` to `/admin/roles/...`, applied
optimistically and rolled back with an error message if the request fails.

It edits the role visibility allow-lists described in
`context/backend-structure.md` §11: a role sees a question if it is granted the
question's competence **or** the section its module sits in, and nothing until
something is granted.

**Not secured yet.** Any signed-in learner with a role sees the menu item and
can use the page — a demo-stage decision. Hiding the button later would only be
UX; the real gate has to be server-side, like `requireRole`. See
[`schema-v3-changes.md`](./schema-v3-changes.md) for the wider change.

---

## 8. Styling

- Global reset + design tokens in `styles/`. Component styles are CSS Modules
  (`Component.module.css`) co‑located with the component.
- No inline `style={{…}}` for anything beyond a one‑off nudge. The current
  inline‑styled screens are refactored to modules during migration.
- **Every color a component uses must be one of the `--color-*` tokens
  below** (never a hardcoded hex/rgb) — that's the only thing that makes
  dark mode automatic instead of a per‑component chore. `npx grep` for
  `#[0-9a-f]{3,8}|rgba?\(` under `src/` before merging a new screen; any hit
  outside `styles/globals.css` itself (and the logo's SVG path data) means a
  token got skipped. Deliberately theme‑agnostic colors (the logo's brand
  colors, the card banner gradients) are tokens too — they just live
  in the theme‑agnostic `:root` block instead of the light/dark ones.
- **The same goes for the other design values:** font sizes
  (`--font-size-*`), font weights (`--font-weight-*`), font families
  (`--font-family-*`), radii (`--radius-*`), shadows (`--shadow-*`),
  animation durations (`--duration-*`) and stacking order (`--z-*`). If a
  value you need isn't in the scale, add it to `globals.css` rather than
  writing a one‑off number in the component. Spacing (padding/margin/gap)
  is not tokenized yet.
- Inline `style={{…}}` is only for values computed at runtime (a progress
  width, a rotation) — and even then it should reference a token
  (`var(--banner-gradient-2)`), not carry its own color.

### Theming: Default / Light / Dark

Modeled on Claude's own visuals picker — Settings has three options, not
a single toggle:

- **Default** — follows the OS/browser's `prefers-color-scheme`.
- **Light** / **Dark** — pinned regardless of the system setting.

**How it works:**

1. `styles/globals.css` defines the full light palette unguarded on `:root`,
   then redefines the same token names twice for dark: once inside
   `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
   (serves "Default" when the OS is dark, but backs off if the learner picked
   "Light" explicitly) and once inside `:root[data-theme="dark"] { … }` (an
   explicit "Dark" choice, wins even on a light‑system browser). Never define
   a color only inside one of those two blocks — both must agree, or the
   toggle and the OS setting can disagree with each other.
2. `app/providers/ThemeProvider.tsx` holds the `preference`
   (`"default" | "light" | "dark"`, persisted via `useLocalStorage`) and sets
   or removes the `data-theme` attribute on `<html>` to match. It also
   exposes `resolvedTheme` (`"light" | "dark"`, resolving what "Default"
   currently means) for the rare case a component can't rely on CSS
   variables — e.g. `GoogleLoginButton` picks a matching Google‑widget theme.
3. `index.html` has a small inline script that applies a stored `data-theme`
   _before_ React mounts, so there's no flash of the wrong theme on first
   paint. It reads the same `localStorage` key `ThemeProvider` writes
   (`aios.themePreference`) — keep them in sync if either changes.
4. The picker itself lives in `features/settings/pages/SettingsPage.tsx`
   ("Choose your visuals"), via `useTheme()`.

**Accent color.** Settings also has "Choose your accent color": the three
AIOS logo colors (purple default, blue, olive). `app/providers/AccentProvider.tsx`
(`useAccent()`, `ACCENTS`, storage key `aios.accentColor`) sets
`data-accent` on `<html>`; `index.html`'s inline script applies it before
mount too. `globals.css` has `:root[data-accent]` rules (after the theme
blocks) that override `--color-primary`, `-hover`, `-contrast` and `-soft`
via `color-mix()` — darkened in light mode, lightened in dark (twice, like
the theme blocks). Components just keep using the `--color-primary*` tokens.

**Token list** (defined for both light and dark — add new ones to _both_
places in `globals.css`, right next to each other, so they can't drift):
`--color-bg`, `--color-surface`, `--color-border`, `--color-text`,
`--color-text-muted`, `--color-primary`, `--color-primary-hover`,
`--color-primary-contrast`, `--color-primary-soft`, `--color-danger`,
`--color-danger-contrast`, `--color-warning`, `--color-warning-bg`,
`--color-success`, `--color-success-bg`, `--color-overlay` (dialog
backdrops), `--color-score-weak`, `--color-score-good`,
`--color-score-strong` (CompetenciesPage's score bands),
`--color-section-tint` (dark only), the card banner colors
(`--banner-purple`, `--banner-blue`, `--banner-green` — the logo's hues,
lifted to light shades in dark mode) and the icon color on them
(`--color-on-banner`), `--decor-strength` (how strong decorative washes
like the dashboard's logo backdrop are; higher in dark mode), `--shadow-sm`,
`--shadow-md`, `--shadow-lg`.

Theme‑agnostic tokens live once, in the first `:root` block of `globals.css`,
and have no dark variant: the brand palette (`--brand-purple`, `--brand-blue`,
`--brand-olive` — the logo colors, which the accent colors, the logo and the
accent picker's swatches all read from), the card banner gradients
(`--banner-gradient-1…3`, one tonal gradient per themed `--banner-*` color), the competence section hues
(`--section-a…e`), `--color-compare` (an earlier assessment on the
results radar; an alias for `--color-text-muted`), layout sizes (`--header-height`,
`--sidebar-width*`, `--bottom-nav-height`), `--radius-*`, `--font-size-*`,
`--font-weight-*`, `--font-family-*`, `--duration-*` and the `--z-*` stacking
scale.

### Third-party widgets: pie-fixed-player

`<pie-fixed-player>` (`@pie-framework/pie-fixed-player-static`, wrapped by
`features/assessment/components/PieQuestionPlayer.tsx`) renders its
question/answer content via Material‑UI (MUI) in the regular **light
DOM — not Shadow DOM**, so global CSS _can_ reach its internals. It's just
built assuming a light page and doesn't read our tokens on its own, so in
dark mode it was rendering dark widget text on our now-dark card
background — unreadable.

**Fix:** `styles/globals.css` overrides its colors directly, targeting the
classes it actually renders (`.MuiTypography-root`, `.MuiFormLabel-root`,
`.choice-label`, `.option-label`, plus raw `svg text`/`svg tspan` for
elements that render via SVG) to our `--color-text` / `--color-border`
tokens, with `!important` (needed to beat MUI's own inline/JS-set styles).
Duplicated across both dark blocks exactly like every other token — never
add this only under `[data-theme="dark"]` or only under
`prefers-color-scheme`, same rule as everywhere else in this file.
`PieQuestionPlayer`'s `.canvas` wrapper is then just a normal themed
surface (`--color-surface` / `--color-text`), not a special case.

This is inherently a bit brittle: it depends on class names inside a
package we don't control, so a future `@pie-framework` upgrade could
silently stop matching. If widget text goes unreadable again, inspect the
rendered markup for its current classes and update the selectors.

This is the pattern for any future embedded/third-party widget that ships
its own styling: isolate it in a small fixed-color container rather than
hoping it inherits our tokens — don't leave it to blend into whatever
`--color-surface` happens to resolve to.

### Responsive / mobile layout

- **Related ticket:** CD-40 — _Should have a web-based and mobile-friendly interface_

One codebase, one set of components — no separate mobile app, no `/m` routes.
Below **768px** the layout switches to a phone layout; from 768px up the
desktop design is unchanged.

| Viewport         | Layout                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| ≥ 1024px         | desktop: collapsible left rail, 32px page padding                                         |
| 768 – 1023px     | same as desktop, 24px page padding                                                        |
| ≤ 767px (mobile) | fixed bottom tab bar, sticky header, 16px page padding, single column, full-width actions |

**The breakpoint.** `shared/lib/breakpoints.ts` is the single source
(`MOBILE_MAX_WIDTH = 767`, `MOBILE_QUERY`). CSS can't import it — media
queries can't use custom properties — so each `.module.css` writes
`@media (max-width: 767px)` by hand. Grep for `767px` if it ever changes.

**Two kinds of media query — pick by what you mean:**

- `@media (max-width: 767px)` — _layout_ (screen size): spacing, columns,
  heading sizes, full-width buttons.
- `@media (pointer: coarse)` — _input_ (touch; also covers tablets and phones
  in landscape, which the width query misses): 44px minimum hit areas
  (`Button`, the header avatar, dropdown items, the course "View source"
  link) and 16px form controls (iOS Safari zooms the whole page when a
  control under 16px is focused, and never zooms back out). Don't use width
  as a stand-in for touch, or the reverse.

**Prefer CSS. Use `useMediaQuery(MOBILE_QUERY)` only when the DOM or props
genuinely differ** — currently exactly two places:

1. `AppShell` renders `<Sidebar layout="side">` _before_ `<main>` on desktop
   and `<Sidebar layout="bottom">` _after_ it on mobile. It's one or the
   other, not both and not CSS-reordered, so Tab order always matches what's
   on screen.
2. `ResultsPage` passes `compact={isMobile}` to `CompetenceRadar`.
3. `AppShell` passes `Header` its `sidebarHidden`/`onToggleSidebar` props only
   on desktop (`undefined` on mobile) — the bottom tab bar can't be hidden,
   so the header's toggle button hides itself entirely rather than
   controlling something meaningless.

The hook reads synchronously (`useSyncExternalStore`), so there's no flash of
the wrong layout on first paint. Never use it for spacing or sizing — that's
what the CSS media queries are for.

**Fixed app shell (every viewport)**

`AppShell.module.css`'s `.shell` is `height: 100%` — deliberately not
`min-height: 100%`, which would let the shell grow taller than the screen on
a long page and hand scrolling to the whole document, carrying the header and
sidebar away with it. Capped like this, `.main`'s own `overflow-y: auto` is
the only thing that scrolls: the header and the side rail (or the mobile tab
bar) never move, and a routed page always renders inside that fixed frame.
`.body { min-height: 0 }` is the other half of this — without it a flex child
can't shrink below its content size, and the cap on `.shell` would do nothing.

The desktop rail has **two separate controls, on purpose two different
states** — easy to conflate, so worth being explicit about:

- **`Header`'s `SidebarToggleIcon` button** (top-left, only rendered when
  `onToggleSidebar` is passed, i.e. not on mobile) toggles `hidden`
  (`useLocalStorage "aios.sidebarHidden"`). This hides the **entire rail** —
  `AppShell` simply doesn't render `<Sidebar>` at all while `hidden` — and
  `<main>` takes the full row width. The button sits in its own `.railSlot`,
  fixed to `--sidebar-width-collapsed` and centred within it, so it lines up
  directly above the sidebar's icon column below (that column's position
  doesn't shift between collapsed/expanded — only the labels do) instead of
  just floating next to the logo. `SidebarToggleIcon` also takes an `open`
  prop (`open={!hidden}`) and draws its left panel filled solid when the
  rail is showing, hollow when it isn't — the icon depicts the *current*
  state, not just a generic toggle glyph, so a click's effect is visible
  before it happens, not just spelled out in the `aria-label`.
- **`Sidebar`'s own bottom-right button** (`.labelToggle`) toggles the
  unrelated `collapsed` state (`useLocalStorage "aios.sidebarCollapsed"`),
  which only hides the nav items' _labels_, icon-only — the rail itself
  stays put, just narrower. It used to be a "Hide"/"Show" text label; it's
  now `icons.tsx`'s shared `ChevronIcon`, sideways rather than up/down since
  that's the direction the rail itself actually resizes in: right-pointing
  (›, its default, no rotation needed) while collapsed — there are labels to
  reveal in that direction — and rotated 180° to point left (‹) once
  expanded, to tuck them back away. `title` carries the same explanation as
  a hover tooltip since there's no text left on the button to read, and
  `aria-label` still names the action for screen readers. Pinned to that
  corner by making
  `.sidebar` a flex column and giving the button `margin-top: auto` (pushes
  it to the bottom, however many nav items sit above it) plus `align-self:
  flex-end` (pins it to the right instead of stretching full-width like the
  nav links above it).

Both replaced an earlier single floating chevron button (absolutely
positioned on the sidebar's right edge) that conflated the two — collapsing
labels and hiding the whole rail were, confusingly, the same click. Don't
reunify them; a learner might want the rail icon-only _and_ still visible.

### Logo

`shared/components/Logo.tsx` renders the AIOS wordmark as inline SVG (not a
raster image) and is used by both `Header` and `LoginPage`. The wordmark
path's fill is `currentColor`, and `Logo.module.css` sets `color:
var(--color-text)`, so it flips between the light/dark palettes the same way
any other text does — no separate dark-mode asset. The colourful dot spiral
next to it keeps the fixed `--brand-*` colors, set as fills in
`Logo.module.css` (it reads fine on both backgrounds). Callers pass their own `className` (composed alongside the
component's own) purely to size it — `Header.module.css`'s `.logo` sets a
fixed height for the header, `LoginPage.module.css`'s centers a larger one
on the card. This replaced a PNG in `public/aios-logo.png` that was seated on
a hardcoded white chip to stay visible on a dark header; that file and hack
are both gone now that the logo is theme-aware.

**App shell on mobile**

- **Header** is sticky (the account menu stays reachable on long pages) and
  grows by the notch inset.
- **Nav** — `Sidebar layout="bottom"`: a fixed tab bar, icon over label,
  `--bottom-nav-height` (60px) plus the home-indicator inset. It always shows
  labels; the persisted `aios.sidebarCollapsed` preference is desktop-only
  and never leaks into it. There's no collapse toggle. Adding a nav item =
  one entry in `NAV_ITEMS`, and it appears in both layouts. Two to five
  items fit comfortably; beyond that, redesign (e.g. a "More" sheet) rather
  than squeezing labels.
- **Clearance** — `<main>`'s bottom padding reserves the bar's height plus
  the inset (`AppShell.module.css`), so pages need nothing extra. Anything
  else you pin to the bottom of the screen must account for the bar itself.
- **Stacking** — the `--z-*` tokens in `globals.css`: bottom bar
  (`--z-bottom-nav`, 20), header (`--z-header`, 30), feedback widget
  (`--z-floating`, 40), dialogs (`--z-dialog`, 900), `RoleGateModal`
  (`--z-modal`, 1000). Slot new fixed UI into that scale.
- **Safe areas** — `index.html` sets `viewport-fit=cover`; the header, tab
  bar and `<main>` add `env(safe-area-inset-*)`. Zoom is **not** disabled (no
  `maximum-scale` / `user-scalable=no`) — keep it that way (WCAG 1.4.4).
- **`RoleGateModal`** scrolls internally on a short viewport (phone in
  landscape) rather than clipping the confirm button. It's still `inert`
  over the rest of the app, tab bar included.

**Component-level decisions worth knowing**

- `CompetenceRadar` `compact` mode: full competence names can't sit beside
  the axes on a 320px screen, so axes get numbered tips and the names +
  scores move into a legend list under the chart (which also gives assistive
  tech the actual numbers). Desktop keeps inline labels.
- `CompetenceRadar` itself only knows how to chart a `CompetenceScore[]` — it
  has no idea whether each axis is a competence or something bigger.
  `ResultsPage`'s overview feeds it 5 _section_ axes (`sectionAxes.ts` sums
  each section's own competences into one score); `SectionDetailsPage`'s
  "More details" drill-down feeds it real competences, one radar per section.
  With 20 competences an all-competences radar would be unreadable, hence the
  two-level split.
- `PieQuestionPlayer`'s `.canvas` has `overflow-x: auto`: a wide third-party
  widget scrolls inside its card instead of pushing the whole page sideways.
- `AppShell`'s `.main` has `min-width: 0`. Without it a flex item grows to
  fit its widest child and drags the page out to horizontal scroll — reach
  for `min-width: 0` on any flex/grid child that holds long text.
- Card grids use `minmax(min(100%, 280px), 1fr)` — a bare `minmax(280px, …)`
  overflows a screen narrower than the column.

**Checklist for a new screen**

1. Constrain the page (`max-width` + `margin: 0 auto`, like the others); no
   fixed pixel widths that can exceed ~288px.
2. Add a `@media (max-width: 767px)` block: smaller padding and headings,
   stack rows, primary action full width.
3. Interactive elements ≥ 44px and inputs ≥ 16px under `pointer: coarse`
   (`Button` already handles it — if you build a bespoke control, you own it).
4. `min-width: 0` on flex/grid children with long text.
5. Tokens only — `--color-*` (so dark mode still works), `--font-size-*`,
   `--radius-*` etc. No hex/rgb or one‑off sizes in the module.
6. Check it at 320, 390, ~768 and desktop, in light and dark, using the
   browser's device toolbar; confirm no horizontal scroll
   (`document.documentElement.scrollWidth <= window.innerWidth`).

**What was verified, and what wasn't** (CD-40)

Checked in headless Chrome with mobile emulation — 390×844, 320×568,
landscape 844×390, desktop 1280×800, light and dark: no horizontal overflow
on any screen; the last piece of content clears the tab bar when scrolled to
the bottom; every touch target is ≥ 44px; the account dropdown stays inside
the viewport; resizing across 767px swaps the nav live (side ↔ bottom, DOM
order following) with no reload; desktop renders as before.

Not covered, so worth a pass before relying on it:

- **Real devices.** Emulation isn't iOS Safari / Android Chrome — the
  on-screen keyboard, `dvh` and safe-area behavior in particular.
- **Other question types.** Only multiple-choice items are seeded, so PIE
  drag-and-drop / matrix-style widgets haven't been seen at phone width. The
  `.canvas` scroll is the safety net, not a guarantee they're usable.
- **Desktop radar with long names.** Inline labels aren't wrapped, and the
  real competence names ("Reproducibility and Research Workflows", …) are
  much longer than the placeholder ones. Compact mode sidesteps this; the
  desktop chart likely needs label wrapping once real scores land.
- **Landscape phones** lose ~116px to header + tab bar. Hiding the bar on
  scroll would fix it; not done.
- **No automated layout tests.** Vitest/RTL can't check layout; a Playwright
  smoke test at two viewport sizes would be the natural next step.

---

## 9. Testing

- Vitest + React Testing Library.
- Tests are co‑located: `RoleSelect.tsx` ↔ `RoleSelect.test.tsx`.
- Priority order the team agreed: feature hooks and `api.ts` mappers first,
  then page happy‑paths, then shared components.

---

## 10. Migration from the current `src/`

Current flat layout → target:

| Today                                                 | Moves to                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/App.tsx` (logic + view)                          | `src/App.tsx` (shell) + logic split into `features/*` pages                             |
| `src/main.tsx`                                        | unchanged, now wraps `<AppProviders>`                                                   |
| `src/Login.tsx`                                       | `features/auth/components/GoogleLoginButton.tsx` + `features/auth/pages/LoginPage.tsx`  |
| `src/RoleSelect.tsx`                                  | `features/onboarding/components/RoleSelect.tsx`                                         |
| `src/QuestionPlayer.tsx`                              | `features/assessment/components/PieQuestionPlayer.tsx`                                  |
| inline `fetch(`${API_URL}...`)` calls                 | `features/*/api.ts` + `shared/api/client.ts`                                            |
| `src/vite-env.d.ts` (JSX decl for `pie-fixed-player`) | `src/types/pie-fixed-player.d.ts` (keep the `vite/client` reference in `vite-env.d.ts`) |
| `localStorage.getItem("aios_token")` scattered        | `features/auth/session.ts`                                                              |

### Rollout order (one PR per step)

1. Add path alias, `config/env.ts`, `shared/api/client.ts`, `shared/api/endpoints.ts`.
2. Introduce `react-router-dom`, `App.tsx` shell, `routes.tsx`, `app/` folder.
3. Extract `auth` feature (incl. `AuthProvider`, `session.ts`, guards).
4. Extract `onboarding` feature (`RoleSelect`).
5. Extract `assessment` feature (`PieQuestionPlayer`, question loading, response saving).
6. Extract `results` feature (`CompetenceRadar`).
7. Convert inline styles to CSS Modules; add `styles/` tokens.
8. Backfill tests per section 9.

Steps 1–2 unblock everything else and should land first.

---

## 11. Quick rules of thumb

- New screen → new `pages/` file in the matching feature.
- Reusable and knows nothing about our domain → `shared/components/`.
- Talks to the backend → a function in a feature `api.ts`.
- Needs the logged‑in user → `useAuth()`.
- Reaching for `../../..` → add or use the `@/` alias instead.
- Importing another feature's internal file → stop; export it from that
  feature's `index.ts` or lift the shared part into `shared/`.
