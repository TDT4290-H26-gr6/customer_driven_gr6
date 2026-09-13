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
├── public/                      # static assets copied as-is (favicon, etc.)
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
    │   │   ├── AppShell.tsx         # header + sidebar + <Outlet/>
    │   │   ├── Header.tsx           # brand left, signed-in user right
    │   │   └── Sidebar.tsx          # collapsible nav
    │   └── guards/
    │       ├── RequireAuth.tsx      # no session -> redirect /login
    │       └── RequireRole.tsx      # no persona chosen -> redirect /onboarding
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
    │   ├── onboarding/              # persona / role selection before the journey
    │   │   ├── components/
    │   │   │   └── RoleSelect.tsx       # dropdown + confirm button
    │   │   ├── pages/
    │   │   │   └── OnboardingPage.tsx
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
    │   ├── courses/                # partner-institution courses/resources
    │   │   ├── components/
    │   │   │   └── CourseCard.tsx        # expandable stat-card, always shows the source link
    │   │   ├── pages/
    │   │   │   └── CoursesPage.tsx
    │   │   ├── api.ts               # GET /courses
    │   │   ├── types.ts             # Course
    │   │   └── index.ts
    │   │
    │   ├── results/                # scores + visualisation
    │   │   ├── components/
    │   │   │   ├── CompetenceRadar.tsx      # radar / spider chart (inline SVG)
    │   │   │   ├── CompetenceBreakdown.tsx
    │   │   │   └── ScoreTable.tsx
    │   │   ├── pages/
    │   │   │   └── ResultsPage.tsx
    │   │   ├── api.ts               # GET /results, GET /competence-scores
    │   │   ├── hooks.ts             # useResults()
    │   │   ├── types.ts             # CompetenceScore, ResultSummary
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
    │   │   └── ErrorBanner.tsx
    │   ├── hooks/
    │   │   ├── useAsync.ts
    │   │   └── useLocalStorage.ts
    │   ├── lib/
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

| Layer                    | May import from                             | Must not import from                |
| ------------------------ | ------------------------------------------- | ----------------------------------- |
| `shared/`                | `shared/`, `config/`                        | `features/`, `app/`                 |
| `features/<x>/`          | its own folder, `shared/`, `config/`        | other `features/`, `app/`           |
| `app/`                   | `features/*/index.ts`, `shared/`, `config/` | feature internals (only the barrel) |
| `App.tsx` / `routes.tsx` | `app/`, `features/*/index.ts`               | anything deep                       |

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
/login        -> LoginPage                       (public)
/onboarding   -> OnboardingPage   (RequireAuth)
/settings     -> SettingsPage     (RequireAuth) — role change, reached from the header's account dropdown
/assessment   -> Assessment* pages (RequireAuth + RequireRole)
/courses      -> CoursesPage       (RequireAuth + RequireRole)
/results      -> ResultsPage       (RequireAuth + RequireRole)
/             -> redirect to the right step based on session + role
```

Guards live in `app/guards/` and are applied in `routes.tsx`.

---

## 8. Styling

- Global reset + design tokens in `styles/`. Component styles are CSS Modules
  (`Component.module.css`) co‑located with the component.
- No inline `style={{…}}` for anything beyond a one‑off nudge. The current
  inline‑styled screens are refactored to modules during migration.

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
