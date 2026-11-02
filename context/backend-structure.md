# Backend & database structure, agreed convention

- **Date:** 2026-09-09
- **Applies to:** `backend/` (Node + Express + TypeScript + Prisma + MySQL 8)
- **Companion to:** [`frontend-structure.md`](./frontend-structure.md), same
  module‑per‑domain idea, applied to the API and the database.

The group has agreed to organise the backend around **domain modules**
("schemas" in the bounded‑context sense): `identity` (users), `assessment`
(questions), `security`, and more later. This document explains what that means
for MySQL, for the Prisma schema, and for `src/`, and how we grow it.

---

## 1. First: what "schema" means in MySQL

MySQL has no PostgreSQL‑style schemas. `CREATE SCHEMA` is literally an alias for
`CREATE DATABASE`, and:

- **InnoDB foreign keys cannot cross databases.** Splitting into real databases
  (`aios_users`, `aios_questions`, …) would break referential integrity between,
  e.g. `Response` (assessment) and `Learner` (identity).
- **Prisma's `multiSchema` feature does not support MySQL**, it is
  PostgreSQL / SQL Server / CockroachDB only.

So we do **not** create multiple physical databases. We keep one database
(`aios`) and model "schemas" as **domain modules** that are separated three ways:

1. a **table‑name prefix** per module (`identity_*`, `assessment_*`, `security_*`),
2. a **Prisma schema file** per module (`prisma/schema/<module>.prisma`),
3. a **`src/` folder** per module (`src/modules/<module>/`).

If a module ever genuinely needs its own database or service, that is a separate
architecture decision (see §9). The module boundaries below are what make that
possible without a rewrite.

---

## 2. Module catalogue (initial)

| Module                | Responsibility                                                                                                                                                                                                                                                                                 | Tables (target names)                                                                                                                                                                                                                                                          | Routes                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`identity`**        | who the user is: accounts, Google sign‑in, the persona role picked at onboarding, initial-assessment completion, and which sections / competences each role may see (allow-lists set by the dataset)                                                                                    | `identity_learner`, `identity_role`, `identity_role_section`, `identity_role_competence`, _(later)_ `identity_session`                                                                                                                                                         | `POST /auth/google`, `GET /auth/me`, `PUT /auth/me/role`, `PUT /auth/me/initial-assessment`, `GET /roles`, `GET /admin/visibility`, `PUT/DELETE /admin/roles/:roleId/sections/:sectionId`, `PUT/DELETE /admin/roles/:roleId/competences/:competenceId` |
| **`assessment`**      | the content hierarchy (competence, section, module), the question bank, self‑assessment runs, answers, scores                                                                                                                                                                                  | `assessment_competence`, `assessment_competence_secondary_source`, `assessment_section`, `assessment_section_module`, `assessment_section_module_secondary_competence`, `assessment_question`, `assessment_sat_instance`, `assessment_response`, `assessment_question_view`, `assessment_competence_score` | `GET /questions`, `GET /assessment/progress`, `POST /assessment/responses`, `POST /assessment/views` (CD-125: a question was shown, first view per learner/kind/attempt only, keyed to the attempt not an instance because the instance is created by the first answer; deleted again when the attempt is aborted), `POST /assessment/complete`, `GET /competence-scores`, `GET /competence-scores/by-section`, `GET /competence-scores/progress` (dashboard: latest vs previous SAT)                                                                                                                      |
| **`sources`**         | third‑party learning resources (courses, training programmes, institutional initiatives) that build a competence                                                                                                                                                                               | `sources_source`                                                                                                                                                                                                                                                               | `GET /sources`                                                                                                                                                                                                                                         |
| **`learningJourney`** | curated step-by-step journeys, the sections each covers, and the score-based recommendation                                                                                                                                                                                                    | `learning_journey_journey`, `learning_journey_journey_section`, `learning_journey_learning_module`, `learning_journey_recommendation`                                                                                                                                          | `GET /learning-journeys`, `GET /learning-journeys/recommendation`                                                                                                                                                                                      |
| **`feedback`**        | what testers say should be improved, sent from the "Feedback" button on every page                                                                                                                                                                                                             | `feedback_feedback`                                                                                                                                                                                                                                                            | `POST /feedback`, `GET /admin/feedback`                                                                                                                                                                                                                |
| **`advisor`**         | AI advice on the dashboard: explains the learner's results, recommends 1–3 Moodle modules, and **ranks the two learning journeys that fit them best on their scores and profile** (occupation, industry, degree, experience, goals, never name or email; best fit highlighted on the dashboard, score-only top two as the fallback: `GET /learning-journeys/recommendations`), via the NTNU IDUN LLM (`lib/llm.ts`); one stored answer per completed SAT instance; off when `LLM_API_KEY` is unset | `advisor_advice`                                                                                                                                                                                                                                                               | `GET /advice`                                                                                                                                                                                                                                          |
| **`stats`**           | admin-only CSV export for analysis (CD-23): two tidy tables over completed full kind:"main" self-assessments only (a targeted reassessment has a different question set, and a kind:"journey" assessment never counts towards the main results, both excluded), no name/email, years of experience bucketed; owns no tables, reads `identity`/`assessment` via Prisma             | _(none, read-only)_                                                                                                                                                                                                                                                          | `GET /admin/stats/tests.csv`, `GET /admin/stats/questions.csv`, `GET /admin/sat/dropoff` (CD-125: per-question drop-off aggregates, abandoned = not completed and last activity (view or answer) older than `inactiveDays`; "stopped here" = last question shown, falling back to last answered for attempts without view rows; computed on demand, no learner fields)                                                                                                                                                                                          |
| **`security`**        | privileged access and traceability                                                                                                                                                                                                                                                             | `security_audit_event` (the curriculum editor's change log); _(later)_ `security_admin`, `security_api_key`                                                                                                                                                                                                         | _(later)_ real admin access. Until then the `/admin/*` routes live in `identity` (§11) and should move here                                                                                                                                            |
| **`platform`**        | cross‑cutting config                                                                                                                                                                                                                                                                           | _(later)_ `platform_app_setting`, `platform_feature_flag`                                                                                                                                                                                                                      |,                                                                                                                                                                                                                                                      |
| **`health`**          | liveness / readiness for ops                                                                                                                                                                                                                                                                   |,                                                                                                                                                                                                                                                                              | `GET /health`                                                                                                                                                                                                                                          |

"`identity`" is what the ticket calls _users_; "`assessment`" is what it calls
_questions_ (the bank plus everything derived from answering it).

### Cross‑module relationships

Foreign keys **may** cross modules because it is still one database
(`assessment_response.learnerId → identity_learner.id`). The rule is about
_writes_, not the key:

> A module's service is the only code that writes that module's tables. Another
> module that needs the data calls the owning module's service (or reads, never
> writes, via Prisma). No module reaches into another module's service internals.

---

## 3. Prisma: one schema folder, one file per module

Split the single `prisma/schema.prisma` into a folder (Prisma's
`prismaSchemaFolder`, preview in Prisma 5.15+, GA in 6.x):

```
database/prisma/             # the database package owns the schema (§4)
├── pre-push.sql             # runs before every db push (see "Schema changes db push can't make")
├── schema/
│   ├── schema.prisma        # generator + datasource ONLY
│   ├── identity.prisma      # Learner, Role, RoleSection, RoleCompetence, (Session)
│   ├── assessment.prisma    # Competence, Section, SectionModule, Question, SatInstance, Response, QuestionView, CompetenceScore + join tables
│   ├── sources.prisma       # Source
│   ├── learningJourney.prisma  # LearningJourney, JourneySection, LearningModule, JourneyRecommendation
│   ├── security.prisma      # AuditEvent (curriculum change log); Admin later
│   └── platform.prisma      # (AppSetting, FeatureFlag), later
└── migrations/              # created when we switch to Prisma Migrate (§7)
```

- Prisma merges every `*.prisma` file in `prisma/schema/`. Models in
  `assessment.prisma` can still relate to models in `identity.prisma`.
- Enable it in the generator block:
  ```prisma
  generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["prismaSchemaFolder"]
  }
  ```
  and point the CLI at the folder via `database/package.json`:
  ```jsonc
  "prisma": { "schema": "./prisma/schema", "seed": "tsx src/index.ts" }
  ```
  The backend generates its own client from the same schema:
  `npm run prisma:generate` in `backend/` copies it into the git-ignored
  `backend/prisma/schema` first, so the client always lands in the backend's
  own `node_modules`. Edit the schema in `database/` only.
- Model names stay unprefixed PascalCase (`Question`). The **table** name gets
  the module prefix:
  ```prisma
  model Question {
    // ...
    @@map("assessment_question")
  }
  ```
  Result: browsing the DB (Adminer / Prisma Studio) shows every `assessment_*`
  table grouped together, the visual "schema" the team wants.

### Naming conventions

| Thing              | Rule                                         | Example                        |
| ------------------ | -------------------------------------------- | ------------------------------ |
| Prisma model       | PascalCase singular, no prefix               | `SatInstance`                  |
| Table (`@@map`)    | `snake_case`, module prefix                  | `assessment_sat_instance`      |
| Columns            | Prisma default camelCase (unchanged for now) | `completedAt`                  |
| Enum‑like `String` | document allowed values in a `//` comment    | `// "self_rating" \| "rubric"` |
| Join / FK field    | `<thing>Id`                                  | `competenceId`                 |

---

## 4. `src/` layout

Mirror the modules; keep framework wiring thin. The backend is **the API only**:
everything that prepares the database (the schema, `pre-push.sql`, the content
datasets and the code that loads them) lives in the separate `database/`
package, which runs as the one-off `db-init` container before the backend
starts (`docker-compose.yml`: mysql → db-init → backend).

```
database/
├── Dockerfile               # db-init: pre-push.sql, prisma db push, then the seed; exits
├── prisma/                  # the schema (§3) and pre-push.sql
└── src/
    ├── index.ts             # db-init's last step: seedChosenDataset(); a failure stops db-init
    ├── config.ts            # SEED_DATASET, MOODLE_BASE_URL
    ├── db/prisma.ts         # this package's PrismaClient
    └── seed/                # content datasets, see §11
        ├── index.ts         # seedChosenDataset(): the SEED_DATASET one, never mixed
        ├── datasetLoader.ts # createDatasetLoader(): load one dataset JSON into an empty database
        ├── pie.ts           # authored question -> PIE item content (buildPieContent)
        ├── contentSync.ts   # `npm run content:sync`: make the DB match the WP2 JSON
        ├── fakeFoodSeed.ts  # the fake food dataset (default)
        ├── wp2Seed.ts       # the real WP2 curriculum (SEED_DATASET=wp2)
        └── data/aios_fake_food_seed.json, aios_wp2_seed.json

backend/src/
├── index.ts                 # process entry: start the server (the database is already prepared)
├── server.ts                # buildServer(): express app + router registration + error handler
├── db/
│   └── prisma.ts            # the single shared PrismaClient
├── middleware/
│   ├── requireAuth.ts       # JWT -> req.learnerId
│   └── requireRole.ts       # requires req.learnerId's persona to be set (403 otherwise)
├── lib/
│   └── asyncHandler.ts      # forwards a rejected async route handler to the error handler
├── modules/
│   ├── identity/
│   │   ├── identity.routes.ts       # /auth/*, /roles, /auth/me/role, /auth/me/privacy-notice (sets Learner.privacyNoticeAcceptedAt)
│   │   ├── identity.admin.routes.ts # GET /admin/visibility: the role allow-lists, for admin mode's filters
│   │   ├── identity.service.ts      # all Prisma access for identity_* tables
│   │   └── identity.types.ts
│   ├── assessment/
│   │   ├── assessment.routes.ts   # /questions, /assessment/*, /competence-scores (all requireRole)
│   │   ├── assessment.service.ts  # role-filtered questions, saving/scoring answers, score roll-up
│   │   ├── assessment.scoring.ts  # pure scoring rules (multiple choice, likert, drag-and-drop)
│   │   ├── assessment.redact.ts   # a question's content without its answers, as learners get it
│   │   └── assessment.pie.ts      # authored question -> PIE item (identical copy of database/src/seed/pie.ts)
│   ├── curriculum/                # the admin curriculum editor (CD-25)
│   │   ├── curriculum.routes.ts      # /admin/curriculum/* (requireAdmin)
│   │   ├── curriculum.service.ts     # questions, competences, sections, modules, journeys: create, edit, delete or retire, restore
│   │   ├── curriculum.audit.ts       # the change log: who changed what, values before and after (security_audit_event)
│   │   ├── curriculum.export.ts      # the whole curriculum as a dataset file db-init can load
│   │   └── curriculum.validation.ts  # what a question of each type needs to be answerable and scorable
│   ├── sources/
│   │   ├── sources.routes.ts      # /sources (requireRole)
│   │   └── sources.service.ts
│   ├── learningJourney/
│   │   ├── learningJourney.routes.ts   # /learning-journeys, /learning-journeys/recommendation
│   │   └── learningJourney.service.ts  # journeys + the recommendation rule
│   ├── security/                  # (added with the module)
│   │   ├── security.routes.ts
│   │   ├── security.service.ts
│   │   └── admin.bootstrap.ts
│   └── health/
│       └── health.routes.ts
└── ...
```

**Responsibilities**

- `*.routes.ts`, HTTP only: parse/validate input, call the service, shape the
  response. No Prisma here.
- `*.service.ts`, the module's logic and the **only** place its tables are
  queried. Exposes plain typed functions.
- `*.types.ts`, request/response and domain types for the module.
- `*.bootstrap.ts`, idempotent startup data for a single module (e.g. a
  future `ensureAdmin`), invoked from `index.ts`. No module has one today: the
  content datasets span every module, so they live in `database/src/seed/`
  instead (§11).
- **The PIE item format is the contract** between the two packages:
  `database/src/seed/pie.ts` writes each question's `content`, and
  `assessment.service.ts` / `assessment.scoring.ts` read it back to score
  answers (choice `value` + `correct`, plus the "I don't know" choice,
  `IDK_VALUE`, defined on both sides). Change it on both sides together.
- `server.ts`, imports each module's router and `app.use()`s it. Adding a
  module = one import + one line here.

---

## 5. Import rules

| Layer                         | May import                                   | Must not import              |
| ----------------------------- | -------------------------------------------- | ---------------------------- |
| `db/`, `lib/`                 | each other                                   | `modules/`                   |
| `modules/<x>/`                | its own folder, `db/`, `lib/`, `middleware/` | another module's internals   |
| `modules/<x>` ↔ `modules/<y>` | the other module's **service** exports only  | its routes, its Prisma calls |
| `server.ts`, `index.ts`       | every module's routes + bootstraps           |,                            |

---

## 6. Cross-cutting concerns

- **Auth**: `middleware/requireAuth.ts` stays shared; it only decodes the JWT.
- **Role gating**: `middleware/requireRole.ts` is chained after `requireAuth`
  on any route that assumes a persona has been picked (`GET /questions`,
  `GET /courses`) and returns `403` otherwise. It's the one deliberate
  exception to "modules import middleware, not the other way around" ,
  it calls `identity.service.ts`'s `findLearnerById` because "has a role"
  is identity's data, and duplicating that check per-module wasn't worth
  avoiding a shared middleware importing one read-only service function.
  This is also the _real_ enforcement behind the frontend's role-gate
  modal (`RoleGateModal`, see `context/frontend-structure.md`): that modal
  is UX, easily defeated by anyone editing their own client-side state, so
  every endpoint it's meant to protect must carry `requireRole` itself.
  Privileged (admin) access is a separate concern and still belongs in
  `security`.
- **Errors**: a single Express error handler in `server.ts` turns anything a
  route throws into a `500` instead of a crashed process. Express 4 does not
  catch a rejected promise from an `async` handler by itself, so **wrap every
  async route handler in `asyncHandler` (`lib/asyncHandler.ts`)**, without it a
  failed database call becomes an unhandled rejection that kills the backend.
  Known, expected failures (e.g. an unknown id → `404`) are still answered in
  the route itself. Mapping _typed_ service errors (`lib/errors.ts`) to status
  codes is still to do.
- **Config**: one `src/config.ts` reads `process.env` once (`DATABASE_URL`,
  `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `BACKEND_PORT`). Nothing else reads
  `process.env`.

---

## 7. Migrations, prerequisite for the table renames

Today the stack runs `prisma db push` on every start, in the `db-init`
container (`database/Dockerfile`). That is unversioned. It runs **without**
`--accept-data-loss`, so a schema change that would drop or narrow data stops
db-init (and the backend with it) instead of deleting anything; a person then
backs up and applies it deliberately (`npm run schema:push:accept-data-loss`,
see the README).

**Before we add `@@map` prefixes** (which rename existing tables) we switch to
**Prisma Migrate**:

1. `prisma migrate dev --name init` to capture the current schema into
   `prisma/migrations/` (committed to git).
2. db-init's start command becomes `prisma migrate deploy` instead of `db push`.
3. The `@@map` rename then ships as a normal migration that MySQL executes as
   `RENAME TABLE`, preserving data.

Until then, `db push` stays.

---

## 8. Rollout plan (one PR per step)

1. **Schema folder.** Enable `prismaSchemaFolder`, move `schema.prisma` →
   `prisma/schema/schema.prisma` (generator + datasource only). `prisma generate`
   and `db push` behave identically. No model or table changes.
2. **Split models by module.** `identity.prisma` + `assessment.prisma`.
   `prisma validate` passes; `db push` is a no‑op.
3. **Switch to Prisma Migrate** (§7). Baseline migration, container runs
   `migrate deploy`.
4. **Add table prefixes.** `@@map("identity_*" / "assessment_*")` on every model;
   ship as one rename migration.
5. **Reorganise `src/`** into `src/modules/*` + `server.ts`. Pure move + re‑import;
   endpoints unchanged. Route→service→Prisma layering introduced here.
6. **`security` module.** `security_admin` (admin allow‑list), `security_audit_event`;
   move admin/bootstrap logic in.
7. **`platform` module** when the first setting/flag is needed.

Steps 1–2 are safe and unblock the rest; do them first.

---

## 9. Adding a module later, checklist

1. `prisma/schema/<module>.prisma`, models, each with
   `@@map("<module>_<table>")`.
2. `src/modules/<module>/`, `<module>.routes.ts`, `<module>.service.ts`,
   `<module>.types.ts` (+ `<module>.bootstrap.ts` if it needs seed data).
3. Register the router (and bootstrap) in `src/server.ts` / `src/index.ts`.
4. `prisma migrate dev --name add-<module>`.
5. Add a row to the catalogue table in §2 of this doc.

---

## 10. Future: true physical separation

If a module ever needs its own database, credentials, or deployment (e.g. the
`security` audit log going to a write‑once store, or `assessment` extracted to
its own service), that module gets:

- its own `datasource` + `PrismaClient`,
- **no** cross‑database FKs, integrity enforced in the service layer,
- an explicit API or event contract instead of a shared client.

Not planned now. The module structure in this document is precisely what keeps
that option cheap later.

---

## 11. Content model, role visibility, scoring and seeding (schema v3)

The shape of what the assessment is _about_, and how it reaches a learner. The
diagram this came from is the "AIOS DB Schema, Role Visibility" Lucidchart.
For what changed on the way there, and why, see
[`schema-v3-changes.md`](./schema-v3-changes.md).

### Content hierarchy

```
Section 1───* SectionModule *───1 Competence (mainCompetenceId)
                    │  *───* Competence          (secondary, via ..._secondary_competence)
                    1
                    │
                    * Question *───1 Competence   (competenceId, the one it assesses)

Competence *───1 Source (primarySourceId);  *───* Source (secondary, via ..._secondary_source)
```

- A **Section** contains **SectionModules**; each module has exactly one _main_
  competence (a plain FK) plus any number of _secondary_ ones (a join table).
- A **Question** belongs to a module **and** names the competence it assesses
  (`competenceId`) directly. Scores roll up by that `competenceId`, **not**
  through the section/module hierarchy, sections and modules organise content
  and gate visibility; they don't compute scores.
- Many-to-many links are join tables with composite keys, never JSON id lists:
  the database can then enforce them and join across them.

### Who sees which questions (role visibility)

Two allow-lists on the learner's **role** (`identity_role_section`,
`identity_role_competence`). A question is visible to a role if **either**

- its competence is granted (`identity_role_competence`), **or**
- its module's section is granted (`identity_role_section`).

A role with no grants sees **nothing** (deny by default). The filter lives in
`assessment.service.ts` (`visibleQuestionFilter`) and drives both
`GET /questions` and `saveResponse`, so a learner is only asked, and only
scored on, what their role can see. Because the rule is OR, revoking a section
does not hide its questions while their competences are still granted.

**Except for a learner's initial assessment.** Everyone gets the _whole_
question bank the first time, regardless of role, that's the point of it
(covering every section and competence). `isInitialAssessment(learnerId)` is
`true` until the learner has completed at least one `SatInstance`; while true,
`visibleQuestionFilter` returns `{}` (everything) instead of the role filter,
and `getRoleGrants` is never even called. Once they've completed one, later
retakes go back to the normal role allow-lists. The score views
(`getLatestCompetenceScores`, `getAttemptSectionScores`) never
re-apply the _current_ role filter to a past instance's results, that would
risk hiding a competence the learner was genuinely just scored on (e.g. after
a role change since that run); they show exactly what that instance actually
covered.

The allow-lists come from the dataset; admin mode only reads them
(`GET /admin/visibility`, `identity.admin.routes.ts`, for its section filter).
The endpoints and screen that edited them were removed while role selection is
off (they're in git history); a grant's `grantedByLearnerId` stays in the schema.
Like all of admin mode, it's limited to the accounts in `ADMIN_EMAILS`
(`requireAdmin`).

### Question types and scoring

Authored simply, stored as PIE. A question's `questionType` decides how
`database/src/seed/pie.ts` builds its PIE item. The choice types below use PIE's
`multiple-choice` element; `ordering` and the three matrix types use a standalone
PIE element of their own (`NativeElementContent`, mounted by `PieQuestionPlayer.tsx`):

| `questionType`  | Authored `content`                        | PIE                       | Score                                                                                                  |
| --------------- | ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `single_choice` | `options[]`, one id in `correctOptionIds` | radio                     | 1 if correct, else 0                                                                                   |
| `true_false`    | two options, one correct                  | radio, order kept         | 1 if correct, else 0                                                                                   |
| `multi_choice`  | `options[]`, several correct ids          | checkbox                  | share of correct options ticked − share of wrong options ticked, floored at 0 (ticking everything = 0) |
| `likert`        | `scale {min,max,minLabel,maxLabel}`, or `labels[]` for every step | radio, ordered `min..max` | the scale value picked ÷ the top of the scale                                                          |
| `criteria_check` | `exhibit` (the example to judge: a README, a change log …) + `options[]` = the criteria, correct ids = those the example meets | checkbox; the exhibit in a box under the prompt (`.aios-exhibit`, globals.css) | as `multi_choice`, so ticking every criterion scores 0 |
| `ordering` | `options[]` in the correct order (`correctOrder`) | `@pie-element/placement-ordering` | share of items in their correct place |
| `true_false_matrix` | `rows[]` (statements), each with `correctColumnId` `true`/`false` | `@pie-element/match` (a table, one radio per cell), columns True / False / I don't know | share of rows answered right; "I don't know" or an empty row counts as wrong |
| `classification_matrix` | `columns[]` (the categories) + `rows[]` (items), each with its `correctColumnId` | as above, a column per category | as above |
| `matching` | `columns[]` (the answers; one no row needs is a distractor, one can fit several rows) + `rows[]` | as above, a column per answer | as above |

Every question is out of 1 point; "I don't know" scores 0 out of 1.

- Each choice's `value` is what gets scored: the option id, or for likert the
  scale number itself. `withShuffledChoices` shuffles answer order, except for
  `likert` and `true_false` where the order is the point.
- `ordering` items are shuffled too, per attempt, and never into the correct
  order: they're authored in that order, and the element takes the order on
  screen as the learner's starting answer. The frontend only counts an
  ordering answer once the learner has moved an item; from then on every
  order counts, the starting one too, so the saved answer is always what's on
  screen.
- All text in a question (prompt, options, rows, columns, the example) is
  HTML-escaped by `assessment.pie.ts`, since PIE renders it as markup: what
  an admin types can't add tags or scripts for learners.
- Learners never get the answers: `/questions` and `/assessment/path` send
  each question through `withoutAnswers` (`assessment.redact.ts`).
  - It keeps only the fields each element needs (an allowlist per element,
    `ALLOWED`), so `correct` flags, `correctResponse`, a matrix row's
    `values`, feedback, rationales and any field added later all stay on the
    server. Anything the browser has can be read in its developer tools, and
    it doesn't need them: scoring reads the stored content.
  - Only the admin curriculum editor (and its preview) sees the answers.
  - A new element, or a new field one needs, has to be added to `ALLOWED`;
    until then it's left out. `assessment.redact.test.ts` builds every WP2
    question with a different right answer and checks that learners get
    exactly the same either way.
- A matrix question learners have answered keeps its columns (they can be
  reworded, not added, removed or reordered): a saved answer is a tick per
  column position, so changing them would move learners' ticks. The editor
  gives every new option, column or row a random id, so a removed one's id
  (which saved answers may point at) never comes back on a different text.
- The seed data's own notes describe `multi_choice` as "1 point per correct
  pick". We kept the existing penalty for wrong picks (it stops "tick
  everything" from scoring full marks). If you want no penalty, change the
  `checkbox` branch of `scoreMultipleChoice` in `assessment.scoring.ts`.
- `completeActiveInstance` sums a finished run's `Response.score` / `maxScore`
  per `question.competenceId` into `assessment_competence_score`.

**"I don't know":** `database/src/seed/pie.ts` appends one extra choice
(`IDK_VALUE`/`IDK_LABEL`, matched by the backend's `assessment.scoring.ts`) to _every_ generated
model, of every type, not authored per-question. Picking it scores `0/0` for
the whole question, checked in `scoreAnswer` before any type-specific scoring
runs, so it overrides everything else even a `multi_choice`'s other ticks. It
still counts as _answered_ (the PIE widget's own `isComplete()` treats
selecting it like any other choice) and the response is still saved, so
`getProgress`/the Next button are unaffected, it just contributes nothing to
either side of the competence total. `withShuffledChoices` never shuffles it
in among the real choices; it's always placed last.

### Recommendation

`recommendJourney` (learningJourney): take the learner's most recent completed
run, find the competence with the lowest `score / maxScore` (competences with
`maxScore` 0 are skipped), then

1. find the sections that competence is taught in, modules whose **main**
   competence it is, or, if none, modules listing it as **secondary**;
2. find journeys covering those sections through `journey_section`, whose
   `coverageLevel` is **M**ain, **R**ecommended or **S**upplementary;
3. pick the best coverage (M beats R beats S), then the journey covering the
   most of those sections, then by name.

A recommendation row is logged only when the recommended journey changes.

### Seeding

There are two content datasets, and `SEED_DATASET` picks which one db-init
loads (`database/src/seed/index.ts`):

| `SEED_DATASET` | File | What it is |
| --- | --- | --- |
| `fake` (default) | `data/aios_fake_food_seed.json` | Fake food-themed test data, described below |
| `wp2` | `data/aios_wp2_seed.json` | The real AIOS WP2 curriculum: sections A–E, 20 modules (A1–E4) with main and secondary competences, 36 competences, the 4 learning journeys, and the self-assessment items delivered so far |

- **Never mixed.** A learner's first assessment covers the whole question bank,
  so two datasets in one database would hand learners both. If the database
  already holds the other dataset, db-init refuses to load it (logged in
  `docker compose logs db-init`, nothing changed) and exits with an error, so
  the backend doesn't start until `SEED_DATASET` is fixed. Switching an
  existing database = back it up, start from an empty one.
- **WP2 is not complete yet**, which is why `fake` stays the default: A1 and A4
  have no items and several modules have 1–2. All 61 items delivered so far
  are loaded, the true/false matrices, classification and matching ones as
  the matrix question types. The file's `_meta` lists the open points
  (modules stored as levels 1–4 although they're parallel topics; mixed
  coverage values like "M/S" stored as their first letter until confirmed).
  `wp2Seed.data.test.ts` checks its structure.
- **Moodle links ("soft" integration).** Sources, section modules and learning
  journeys are authored with a placeholder `moodleCourseId`; the loader builds
  the link from `MOODLE_BASE_URL` + that id (`moodleUrl` on modules and
  journeys, `sourceUrl` on sources). A row may give a full `moodleUrl` instead,
  which wins. Changing the base URL or ids in the dataset reaches an existing
  database through `npm run content:sync`, so swapping the placeholders for
  real links is a data change.

`database/src/seed/fakeFoodSeed.ts` loads `database/src/seed/data/aios_fake_food_seed.json`, a
**fake**, food-themed dataset that _is_ every learner's initial assessment:
**5 sections (A–E) × 4 section modules (levels 1–4, one competence each) ×
3 questions = 60 questions**, plus 26
Moodle-linked sources (each competence has its own primary source and 1–2
secondary ones) and 4 fake roles. It covers every table except those a learner
fills in (`sat_instance`, `response`, `competence_score`, `recommendation`). It
is inserted in dependency order with `createMany({ skipDuplicates: true })`,
so running it again never duplicates or overwrites.

- **Automatically, into an empty database only:** db-init runs
  `seedChosenDataset()` (`database/src/index.ts`) before the backend starts. A
  database that holds none of the dataset gets all of it. **Once a database has
  its content, the database is the source of truth**: admins change it in the
  curriculum editor, and db-init never re-adds what was deleted or overwrites
  what was edited. The one thing it still does is fill in a question's
  `authoredContent` where it's empty (databases from before the editor).
- **Dataset updates** (e.g. new WP2 items) reach an existing database only on
  purpose: `docker compose run --rm db-init npm run content:sync` shows what
  would change, and `-- --apply` applies it. Applying overwrites edits made in
  the curriculum editor to the rows in the file. To only add what's new (e.g.
  newly delivered items) and leave everything edited in the editor alone, use
  `-- --only-new --apply`: it adds rows the database doesn't have, with their
  links, and never re-adds anything the change log says an admin deleted. A
  new row pointing at something deleted (a new question in a deleted module)
  is left out and listed in the dry run, rather than failing the apply.
- **Rebuilding stored questions:** learners get each question's stored
  `content`, built when it was saved. After a change to how questions are
  built (`pie.ts`, e.g. escaping prompts as HTML), `docker compose run --rm
  db-init npm run content:rebuild` lists the questions stored differently
  from how they're built now, and `-- --apply` rebuilds them from their
  authored form. Nothing else changes: not the prompt, the answers or the
  scores.
- **Links in a dataset** (a module's or journey's `moodleUrl`, a source's
  `sourceUrl`) must be web addresses (http or https), the same rule as the
  curriculum editor: loading or syncing a file with any other link fails,
  naming the row.
- **By hand:** `docker compose run --rm db-init npm run seed` (or `npm run seed`
  in `database/`) runs the same loader.
- The seed authors questions in the simple shape above; the loader converts them
  with `buildPieContent` (which also appends the "I don't know" choice, see
  above), and also stores the authored form (`authoredContent`). To change the
  questions of a running system, use the curriculum editor (admin mode → Edit
  curriculum); editing the JSON only affects new databases and `content:sync`
  (a new question there needs a real `sectionModuleId` and the `competenceId`
  of that module; in the fake dataset every module (level) has exactly 3
  questions, `fakeFoodSeed.data.test.ts` checks this).
- **Retired content:** the editor deletes only what nothing uses, and retires
  (`retiredAt`) the rest, which can be restored:
  - a question is deleted when nobody has answered it;
  - a module is deleted when it has no questions;
  - a section is deleted when it has no modules, no journey covers it and no
    reassessment was limited to it;
  - a learning journey is deleted when nothing refers to it: never
    recommended, picked by the AI advisor, assessed or completed.

  Retired content is left out everywhere learners see it:
  `roleQuestionFilter` drops questions that are retired or in a retired
  module or section (the assessment, saving answers, the reassessment
  picker); the Competencies tab, the competence → section mapping behind
  recommendations, the AI advice's candidates, the journeys page's coverage
  and the admin visibility matrix skip retired modules and sections. A
  retired journey is left out of the journeys page, recommendations, the AI
  advice's candidates and the Competencies tab's "most relevant", reads as
  gone in stored advice (`findJourney`), and can't be assessed. "See
  results by section" counts a retired question or module only where that
  attempt answered it.
- **Change log:** every change made in the curriculum editor (created,
  edited, retired, restored, deleted) is written to `security_audit_event` in
  the same transaction as the change (`curriculum.audit.ts`), with the
  admin's name and email and the item's editable values before and after as
  JSON. The name and email are copied into the entry, so it stays readable
  after the account is deleted. The editor shows each item's "Added by … ·
  Edited by …" line; the full log is **Download change log (CSV)** in the
  editor (`GET /admin/curriculum/changelog.csv`). Like every CSV here (`toCsv`
  in `stats.csv.ts`), a text field that would start a spreadsheet formula
  (`=`, `+`, `-`, `@`) gets a leading `'`, so a name or item text can't run
  as one when the file is opened in Excel. Items loaded from a dataset
  have no "Added by" line, and nothing before this log existed is in it.
- **Moving the curriculum:** **Download curriculum (JSON)** in the editor
  (`GET /admin/curriculum/export.json`, `curriculum.export.ts`) writes the
  database's curriculum in the dataset format above: sources, competences,
  sections, modules, questions (as authored), journeys with their steps,
  roles and grants, removed items with their `retiredAt`, and full Moodle
  links. No learners, answers, results or change log. Put it in place of
  `data/aios_wp2_seed.json` and db-init loads it into an empty database. The
  committed WP2 file stays the starting point for new databases, tests and
  `content:sync`.
- The assessment is adaptive (`assessment.path.ts`): sections in a random order
  per attempt, levels 1 → 4 within each. Every question of a level is asked;
  the learner moves up a level at 2 of 3 right (2/3 of the level's points)
  and on to the next section as soon as that's out of reach. A module's
  `level` therefore decides when its questions are asked. Questions never
  asked (the rest of a failed level and the levels above it) still count in
  the scores, as 0 of 1, so every SAT is scored over the same questions.
- There is no longer a default-roles bootstrap: roles come from the seed, so the
  role picker lists the seed's (fake) roles.
- **The earlier open-science content was removed** once the WP2 curriculum
  replaced it (`openScienceSeed.ts` and `data/aios_open_science_seed.json`,
  dormant since schema v3). It's in git history if it's ever needed again.

### Journey assessments and the Competencies overview

- **Two kinds of SAT instance** (`SatInstance.kind`, `assessment.kinds.ts`):
  `main` (the self-assessment: the initial one and its retakes) and `journey`
  (a learner assessing one learning journey on its own). Each kind is numbered
  on its own (`@@unique([learnerId, kind, instanceNum])`), so main assessments
  stay 1, 2, 3 … whatever journey assessments happen in between.
- **A journey assessment never touches the main results.** Every main-results
  query filters on `kind: "main"`: History, the dashboard's per-assessment
  results and progress, the shared newest-scores query (dashboard radar,
  journey recommendation, weak competences, AI advice), and the "has done the
  self-assessment" check (`hasCompletedMainAssessment`, which also guards
  `PUT /auth/me/initial-assessment`). Only one assessment of any kind can be
  in progress at a time.
- `POST /assessment/journey` (`startJourneyAssessment`) limits the instance to
  the journey's **M sections** that have questions (the same `SatInstanceSection`
  mechanism a reassessment uses). The runner shows which journey, and finishes
  on Competencies instead of the dashboard. It replaces the old "select a
  journey" (CD-33), which is removed.
- `GET /competencies` (`getCompetencies`, pure logic in
  `assessment.competencies.ts`): each module's **best** result over **all**
  completed assessments, main and journey alike; a section's percentage is the
  average of its modules' best results (modules without a result left out).
  The M sections of the journey recommended after the latest main assessment
  (the AI advisor's pick, else the score-based recommendation, else the
  suggestion) are marked relevant and come first.

### Schema changes db push can't make on its own

`prisma db push` runs on every start (db-init, `database/Dockerfile`). A few
MySQL changes need a step first: `database/prisma/pre-push.sql` runs before it, and is idempotent (a no-op
when there's nothing to do, or on a fresh database). Today it creates the
`assessment_sat_instance(learnerId)` index, MySQL won't drop the old
`(learnerId, instanceNum)` unique key while it's the only index behind the
learner foreign key, and `db push` drops it before creating the new index.

### Resetting the database

The stack still uses `prisma db push` (§7), which cannot rename tables or
tighten a unique constraint over existing duplicates, and db-init never accepts
data loss on its own. When a schema change would lose data, either apply it
deliberately after a backup (README, "Schema changes that would lose data"),
or, locally, wipe the volume and start over:

```
docker compose down
docker volume rm customer_driven_gr6_mysql_data
docker compose up -d --build     # rebuild: the schema is baked into the images, not bind-mounted
```

db-init recreates the tables and loads the dataset on the next start. This
deletes all local data, including your own learner account and answers.
