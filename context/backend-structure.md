# Backend & database structure — agreed convention

- **Date:** 2026-09-09
- **Applies to:** `backend/` (Node + Express + TypeScript + Prisma + MySQL 8)
- **Companion to:** [`frontend-structure.md`](./frontend-structure.md) — same
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
- **Prisma's `multiSchema` feature does not support MySQL** — it is
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
| **`identity`**        | who the user is: accounts, Google sign‑in, the persona role picked at onboarding, initial-assessment completion, and which sections / competences each role may see (the allow-lists managed in admin mode)                                                                                    | `identity_learner`, `identity_role`, `identity_role_section`, `identity_role_competence`, _(later)_ `identity_session`                                                                                                                                                         | `POST /auth/google`, `GET /auth/me`, `PUT /auth/me/role`, `PUT /auth/me/initial-assessment`, `GET /roles`, `GET /admin/visibility`, `PUT/DELETE /admin/roles/:roleId/sections/:sectionId`, `PUT/DELETE /admin/roles/:roleId/competences/:competenceId` |
| **`assessment`**      | the content hierarchy (competence, section, module), the question bank, self‑assessment runs, answers, scores                                                                                                                                                                                  | `assessment_competence`, `assessment_competence_secondary_source`, `assessment_section`, `assessment_section_module`, `assessment_section_module_secondary_competence`, `assessment_question`, `assessment_sat_instance`, `assessment_response`, `assessment_competence_score` | `GET /questions`, `GET /assessment/progress`, `POST /assessment/responses`, `POST /assessment/complete`, `GET /competence-scores`, `GET /competence-scores/by-section`, `GET /competence-scores/progress` (dashboard: latest vs previous SAT)                                                                                                                      |
| **`sources`**         | third‑party learning resources (courses, training programmes, institutional initiatives) that build a competence                                                                                                                                                                               | `sources_source`                                                                                                                                                                                                                                                               | `GET /sources`                                                                                                                                                                                                                                         |
| **`learningJourney`** | curated step-by-step journeys, the sections each covers, and the score-based recommendation                                                                                                                                                                                                    | `learning_journey_journey`, `learning_journey_journey_section`, `learning_journey_learning_module`, `learning_journey_recommendation`                                                                                                                                          | `GET /learning-journeys`, `GET /learning-journeys/recommendation`                                                                                                                                                                                      |
| **`feedback`**        | what testers say should be improved, sent from the "Feedback" button on every page                                                                                                                                                                                                             | `feedback_feedback`                                                                                                                                                                                                                                                            | `POST /feedback`, `GET /admin/feedback`                                                                                                                                                                                                                |
| **`advisor`**         | AI advice on the results page: explains the score-based journey recommendation and suggests next steps from the journey and the sources linked to the weakest competences, via the NTNU IDUN LLM (`lib/llm.ts`); one stored answer per completed SAT instance; off when `LLM_API_KEY` is unset | `advisor_advice`                                                                                                                                                                                                                                                               | `GET /advice`                                                                                                                                                                                                                                          |
| **`security`**        | privileged access and traceability                                                                                                                                                                                                                                                             | _(later)_ `security_admin`, `security_audit_event`, `security_api_key`                                                                                                                                                                                                         | _(later)_ real admin access. Until then the `/admin/*` routes live in `identity` (§11) and should move here                                                                                                                                            |
| **`platform`**        | cross‑cutting config                                                                                                                                                                                                                                                                           | _(later)_ `platform_app_setting`, `platform_feature_flag`                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                      |
| **`health`**          | liveness / readiness for ops                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                              | `GET /health`                                                                                                                                                                                                                                          |

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
`prismaSchemaFolder` — preview in Prisma 5.15+, GA in 6.x):

```
backend/prisma/
├── schema/
│   ├── schema.prisma        # generator + datasource ONLY
│   ├── identity.prisma      # Learner, Role, RoleSection, RoleCompetence, (Session)
│   ├── assessment.prisma    # Competence, Section, SectionModule, Question, SatInstance, Response, CompetenceScore + join tables
│   ├── sources.prisma       # Source
│   ├── learningJourney.prisma  # LearningJourney, JourneySection, LearningModule, JourneyRecommendation
│   ├── security.prisma      # (Admin, AuditEvent)  — added when the module lands
│   └── platform.prisma      # (AppSetting, FeatureFlag) — later
├── migrations/              # created when we switch to Prisma Migrate (§7)
└── seed.ts
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
  and point the CLI at the folder via `backend/package.json`:
  ```jsonc
  "prisma": { "schema": "./prisma/schema", "seed": "tsx prisma/seed.ts" }
  ```
- Model names stay unprefixed PascalCase (`Question`). The **table** name gets
  the module prefix:
  ```prisma
  model Question {
    // ...
    @@map("assessment_question")
  }
  ```
  Result: browsing the DB (Adminer / Prisma Studio) shows every `assessment_*`
  table grouped together — the visual "schema" the team wants.

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

Mirror the modules; keep framework wiring thin.

```
backend/src/
├── index.ts                 # process entry: seed a fresh database, then start the server
├── server.ts                # buildServer(): express app + router registration + error handler
├── db/
│   └── prisma.ts            # the single shared PrismaClient
├── middleware/
│   ├── requireAuth.ts       # JWT -> req.learnerId
│   └── requireRole.ts       # requires req.learnerId's persona to be set (403 otherwise)
├── lib/
│   └── asyncHandler.ts      # forwards a rejected async route handler to the error handler
├── seed/                    # content datasets, loaded at start — see §11
│   ├── index.ts             # seedChosenDataset(): the SEED_DATASET one, never mixed
│   ├── datasetLoader.ts     # createDatasetLoader(): load / bring up to date one dataset JSON
│   ├── fakeFoodSeed.ts      # the fake food dataset (default)
│   ├── wp2Seed.ts           # the real WP2 curriculum (SEED_DATASET=wp2)
│   └── data/aios_fake_food_seed.json, aios_wp2_seed.json
├── modules/
│   ├── identity/
│   │   ├── identity.routes.ts       # /auth/*, /roles, /auth/me/role
│   │   ├── identity.admin.routes.ts # /admin/* — role visibility grants (admin mode)
│   │   ├── identity.service.ts      # all Prisma access for identity_* tables
│   │   └── identity.types.ts
│   ├── assessment/
│   │   ├── assessment.routes.ts   # /questions, /assessment/*, /competence-scores (all requireRole)
│   │   ├── assessment.service.ts  # role-filtered questions, saving/scoring answers, score roll-up
│   │   ├── assessment.scoring.ts  # pure scoring rules (multiple choice, likert, drag-and-drop)
│   │   └── assessment.pie.ts      # authored question -> PIE item content
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

- `*.routes.ts` — HTTP only: parse/validate input, call the service, shape the
  response. No Prisma here.
- `*.service.ts` — the module's logic and the **only** place its tables are
  queried. Exposes plain typed functions.
- `*.types.ts` — request/response and domain types for the module.
- `*.bootstrap.ts` — idempotent startup data for a single module (e.g. a
  future `ensureAdmin`), invoked from `index.ts`. No module has one today: the
  dev dataset spans every module, so it lives in `src/seed/` instead (§11).
- `server.ts` — imports each module's router and `app.use()`s it. Adding a
  module = one import + one line here.

---

## 5. Import rules

| Layer                         | May import                                   | Must not import              |
| ----------------------------- | -------------------------------------------- | ---------------------------- |
| `db/`, `lib/`                 | each other                                   | `modules/`                   |
| `modules/<x>/`                | its own folder, `db/`, `lib/`, `middleware/` | another module's internals   |
| `modules/<x>` ↔ `modules/<y>` | the other module's **service** exports only  | its routes, its Prisma calls |
| `server.ts`, `index.ts`       | every module's routes + bootstraps           | —                            |

---

## 6. Cross-cutting concerns

- **Auth**: `middleware/requireAuth.ts` stays shared; it only decodes the JWT.
- **Role gating**: `middleware/requireRole.ts` is chained after `requireAuth`
  on any route that assumes a persona has been picked (`GET /questions`,
  `GET /courses`) and returns `403` otherwise. It's the one deliberate
  exception to "modules import middleware, not the other way around" —
  it calls `identity.service.ts`'s `findLearnerById` because "has a role"
  is identity's data, and duplicating that check per-module wasn't worth
  avoiding a shared middleware importing one read-only service function.
  This is also the _real_ enforcement behind the frontend's role-gate
  modal (`RoleGateModal` — see `context/frontend-structure.md`): that modal
  is UX, easily defeated by anyone editing their own client-side state, so
  every endpoint it's meant to protect must carry `requireRole` itself.
  Privileged (admin) access is a separate concern and still belongs in
  `security`.
- **Errors**: a single Express error handler in `server.ts` turns anything a
  route throws into a `500` instead of a crashed process. Express 4 does not
  catch a rejected promise from an `async` handler by itself, so **wrap every
  async route handler in `asyncHandler` (`lib/asyncHandler.ts`)** — without it a
  failed database call becomes an unhandled rejection that kills the backend.
  Known, expected failures (e.g. an unknown id → `404`) are still answered in
  the route itself. Mapping _typed_ service errors (`lib/errors.ts`) to status
  codes is still to do.
- **Config**: one `src/config.ts` reads `process.env` once (`DATABASE_URL`,
  `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `BACKEND_PORT`). Nothing else reads
  `process.env`.

---

## 7. Migrations — prerequisite for the table renames

Today the stack runs `prisma db push --accept-data-loss` on container start
(`backend/Dockerfile`). That is fine for a throw‑away scaffold but it is
unversioned and destructive.

**Before we add `@@map` prefixes** (which rename existing tables) we switch to
**Prisma Migrate**:

1. `prisma migrate dev --name init` to capture the current schema into
   `prisma/migrations/` (committed to git).
2. Container start command becomes `prisma migrate deploy` instead of `db push`.
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

## 9. Adding a module later — checklist

1. `prisma/schema/<module>.prisma` — models, each with
   `@@map("<module>_<table>")`.
2. `src/modules/<module>/` — `<module>.routes.ts`, `<module>.service.ts`,
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
- **no** cross‑database FKs — integrity enforced in the service layer,
- an explicit API or event contract instead of a shared client.

Not planned now. The module structure in this document is precisely what keeps
that option cheap later.

---

## 11. Content model, role visibility, scoring and seeding (schema v3)

The shape of what the assessment is _about_, and how it reaches a learner. The
diagram this came from is the "AIOS DB Schema — Role Visibility" Lucidchart.
For what changed on the way there, and why, see
[`schema-v3-changes.md`](./schema-v3-changes.md).

### Content hierarchy

```
Section 1───* SectionModule *───1 Competence (mainCompetenceId)
                    │  *───* Competence          (secondary, via ..._secondary_competence)
                    1
                    │
                    * Question *───1 Competence   (competenceId — the one it assesses)

Competence *───1 Source (primarySourceId);  *───* Source (secondary, via ..._secondary_source)
```

- A **Section** contains **SectionModules**; each module has exactly one _main_
  competence (a plain FK) plus any number of _secondary_ ones (a join table).
- A **Question** belongs to a module **and** names the competence it assesses
  (`competenceId`) directly. Scores roll up by that `competenceId`, **not**
  through the section/module hierarchy — sections and modules organise content
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
`GET /questions` and `saveResponse`, so a learner is only asked — and only
scored on — what their role can see. Because the rule is OR, revoking a section
does not hide its questions while their competences are still granted.

**Except for a learner's initial assessment.** Everyone gets the _whole_
question bank the first time, regardless of role — that's the point of it
(covering every section and competence). `isInitialAssessment(learnerId)` is
`true` until the learner has completed at least one `SatInstance`; while true,
`visibleQuestionFilter` returns `{}` (everything) instead of the role filter,
and `getRoleGrants` is never even called. Once they've completed one, later
retakes go back to the normal role allow-lists. The score views
(`getLatestCompetenceScores`, `getAttemptSectionScores`) never
re-apply the _current_ role filter to a past instance's results — that would
risk hiding a competence the learner was genuinely just scored on (e.g. after
a role change since that run); they show exactly what that instance actually
covered.

**Admin mode** (`/admin/*`, `identity.admin.routes.ts`) edits these allow-lists;
each grant is stamped with `grantedByLearnerId`. **It is not secured yet** — any
signed-in learner who has picked a role can call it. That is a demo-stage
decision; gate it on a real admin check (the planned `security` module) before
real users exist.

### Question types and scoring

Authored simply, stored as PIE. A question's `questionType` decides how
`assessment.pie.ts` builds its PIE item; **all five use PIE's `multiple-choice`
element** (already rendered and scored by the app):

| `questionType`  | Authored `content`                        | PIE                       | Score                                                                                                  |
| --------------- | ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `single_choice` | `options[]`, one id in `correctOptionIds` | radio                     | 1 if correct, else 0                                                                                   |
| `true_false`    | two options, one correct                  | radio, order kept         | 1 if correct, else 0                                                                                   |
| `multi_choice`  | `options[]`, several correct ids          | checkbox                  | share of correct options ticked − share of wrong options ticked, floored at 0 (ticking everything = 0) |
| `likert`        | `scale {min,max,minLabel,maxLabel}`, or `labels[]` for every step | radio, ordered `min..max` | the scale value picked ÷ the top of the scale                                                          |
| `criteria_check` | `exhibit` (the example to judge: a README, a change log …) + `options[]` = the criteria, correct ids = those the example meets | checkbox; the exhibit in a box under the prompt (`.aios-exhibit`, globals.css) | as `multi_choice`, so ticking every criterion scores 0 |

Every question is out of 1 point; "I don't know" scores 0 out of 1.

- Each choice's `value` is what gets scored: the option id, or for likert the
  scale number itself. `withShuffledChoices` shuffles answer order, except for
  `likert` and `true_false` where the order is the point.
- The seed data's own notes describe `multi_choice` as "1 point per correct
  pick". We kept the existing penalty for wrong picks (it stops "tick
  everything" from scoring full marks). If you want no penalty, change the
  `checkbox` branch of `scoreMultipleChoice` in `assessment.scoring.ts`.
- `completeActiveInstance` sums a finished run's `Response.score` / `maxScore`
  per `question.competenceId` into `assessment_competence_score`.

**"I don't know":** `assessment.pie.ts` appends one extra choice
(`IDK_VALUE`/`IDK_LABEL` in `assessment.scoring.ts`) to _every_ generated
model, of every type — not authored per-question. Picking it scores `0/0` for
the whole question, checked in `scoreAnswer` before any type-specific scoring
runs, so it overrides everything else even a `multi_choice`'s other ticks. It
still counts as _answered_ (the PIE widget's own `isComplete()` treats
selecting it like any other choice) and the response is still saved, so
`getProgress`/the Next button are unaffected — it just contributes nothing to
either side of the competence total. `withShuffledChoices` never shuffles it
in among the real choices; it's always placed last.

### Recommendation

`recommendJourney` (learningJourney): take the learner's most recent completed
run, find the competence with the lowest `score / maxScore` (competences with
`maxScore` 0 are skipped), then

1. find the sections that competence is taught in — modules whose **main**
   competence it is, or, if none, modules listing it as **secondary**;
2. find journeys covering those sections through `journey_section`, whose
   `coverageLevel` is **M**ain, **R**ecommended or **S**upplementary;
3. pick the best coverage (M beats R beats S), then the journey covering the
   most of those sections, then by name.

A recommendation row is logged only when the recommended journey changes.

### Seeding

There are two content datasets, and `SEED_DATASET` picks which one the backend
loads (`src/seed/index.ts`):

| `SEED_DATASET` | File | What it is |
| --- | --- | --- |
| `fake` (default) | `data/aios_fake_food_seed.json` | Fake food-themed test data, described below |
| `wp2` | `data/aios_wp2_seed.json` | The real AIOS WP2 curriculum: sections A–E, 20 modules (A1–E4) with main and secondary competences, 36 competences, the 6 learning journeys, and the self-assessment items delivered so far |

- **Never mixed.** A learner's first assessment covers the whole question bank,
  so two datasets in one database would hand learners both. If the database
  already holds the other dataset, the backend refuses to load (logged at start,
  nothing changed). Switching an existing database = back it up, start from an
  empty one.
- **WP2 is not complete yet**, which is why `fake` stays the default: A1 and A4
  have no items, several modules have 1–2, and items of types the app can't
  render yet (matrices, ordering, matching) are kept in the file's
  `_pendingItems` instead of loaded. The file's `_meta` lists the open points
  (modules stored as levels 1–4 although they're parallel topics; mixed
  coverage values like "M/S" stored as their first letter until confirmed).
  `wp2Seed.data.test.ts` checks its structure.
- **Moodle links ("soft" integration).** Sources, section modules and learning
  journeys are authored with a placeholder `moodleCourseId`; the loader builds
  the link from `MOODLE_BASE_URL` + that id (`moodleUrl` on modules and
  journeys, `sourceUrl` on sources). A row may give a full `moodleUrl` instead,
  which wins. Changing the base URL or ids updates existing rows on the next
  start, so swapping the placeholders for real links is a data change.

`src/seed/fakeFoodSeed.ts` loads `src/seed/data/aios_fake_food_seed.json` — a
**fake**, food-themed dataset that _is_ every learner's initial assessment:
**5 sections (A–E) × 4 section modules (levels 1–4, one competence each) ×
3 questions = 60 questions**, plus 26
Moodle-linked sources (each competence has its own primary source and 1–2
secondary ones) and 4 fake roles. It covers every table except those a learner
fills in (`sat_instance`, `response`, `competence_score`, `recommendation`). It
is inserted in dependency order with `createMany({ skipDuplicates: true })`,
so running it again never duplicates or overwrites.

- **Automatically:** `index.ts` runs `seedChosenDataset()` before the server
  starts — when any of the dataset's questions are missing, it loads the
  whole thing (adding only what's missing), then makes sure section codes,
  module levels, competence names and Moodle links match the JSON. A fresh
  database therefore opens with every question, and an older one picks up new
  questions, codes, levels and links, with no manual step.
- **By hand:** `npx prisma db seed` runs the same loader.
- The seed authors questions in the simple shape above; the loader converts them
  with `buildPieContent` (which also appends the "I don't know" choice — see
  above). To add or change questions, edit the JSON (a new question needs a
  real `sectionModuleId` and the `competenceId` of that module, and every
  module (level) has exactly 3 questions — `fakeFoodSeed.data.test.ts` checks
  this).
- The assessment is adaptive (`assessment.path.ts`): sections in a random order
  per attempt, levels 1 → 4 within each, moving up a level at 2 of 3 right
  (2/3 of the level's points) and on to the next section once that's out of
  reach. A module's `level` therefore
  decides when its questions are asked.
- There is no longer a default-roles bootstrap: roles come from the seed, so the
  role picker lists the seed's (fake) roles.
- **The real open-science content is dormant, not deleted.**
  `src/seed/openScienceSeed.ts` + `data/aios_open_science_seed.json` are
  untouched and still valid, but nothing calls `seedOpenScienceContent()` —
  neither `index.ts` nor `prisma/seed.ts` — so it never runs. To bring it back
  (e.g. as a _second_, later assessment rather than the initial one), call it
  from one of those two files again.

### Resetting the database

The stack still uses `prisma db push` (§7), which cannot rename tables or
tighten a unique constraint over existing duplicates. When the schema changes
in a way `db push` refuses, wipe the local volume and start over:

```
docker compose down
docker volume rm customer_driven_gr6_mysql_data
docker compose up -d --build     # rebuild: prisma/ is baked into the image, not bind-mounted
```

The backend recreates the tables and seeds itself on the next start. This
deletes all local data, including your own learner account and answers.
