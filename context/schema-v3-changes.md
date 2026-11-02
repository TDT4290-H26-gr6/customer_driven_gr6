# Schema v3, role visibility, section/module hierarchy, sources, admin mode

- **Date:** 2026-09-23
- **Branch:** `dbschema/changes_to_db`
- **Based on:** the "AIOS DB Schema, Role Visibility" Lucidchart diagram and
  `aios_fake_food_seed.json`
- **Companion docs:** [`backend-structure.md`](./backend-structure.md) §11 (how the
  model behaves) and [`frontend-structure.md`](./frontend-structure.md) (the
  admin and sources features)

This is a record of what changed, why, and what is still open. The two structure
docs describe the result; this one describes the move.

---

## Update, 2026-09-28: a full-bank, no-guessing initial assessment

**Branch:** `CD-8-Present-no-more-than-50-questions-to-each-user`

- **Dataset grown 5×2×3 → 5×4×3:** the fake food dataset now has 20
  competences (4 per section, up from 10) and 60 questions (up from 30), 3 per
  competence. 6 sources → 26: every competence gets its own primary source
  plus 1–2 secondary ones, and every source (old and new) links to a
  placeholder Moodle course (`moodleCourseId` in the seed JSON, resolved to a
  URL by `MOODLE_BASE_URL` in `fakeFoodSeed.ts`).
- **Everyone's initial assessment is now the whole bank, regardless of role.**
  `isInitialAssessment` (no completed `SatInstance` yet) makes
  `visibleQuestionFilter` return "everything" instead of the role allow-list
  until a learner finishes their first run; the role filter applies to every
  run after that. The two score views (`getLatestCompetenceScores`,
  `getLatestSectionCompetenceScores`) no longer re-apply the _current_ role
  filter at all, they show whatever a past instance actually covered.
- **A no-penalty "I don't know" choice on every question.** Appended by
  `assessment.pie.ts` to every generated PIE model (not authored per
  question); selecting it always scores `0/0` for that question, checked in
  `scoreAnswer` before any type-specific scoring, so it overrides other ticks
  on a `multi_choice` too. It's still a real choice, so it still counts as
  _answered_.
- **Dashboard overview is now per-section, not per-competence.** 20
  competences don't fit as one radar's axes; `DashboardPage` now shows 5 section
  axes (`dashboard/sectionAxes.ts` sums each section's competences into one
  score), and "More details" (`SectionDetailsPage`, pre-existing) is now the
  only per-competence view. `GET /competence-scores` and the frontend's
  `getCompetenceScores` are removed as now-unused (the by-section endpoint
  covers both views).
- **The real open-science seed is dormant, not deleted.**
  `openScienceSeed.ts` / `aios_open_science_seed.json` are untouched; nothing
  calls `seedOpenScienceContent()` any more. (Both were removed later, once
  the WP2 curriculum replaced them; they're in git history.)
- CD-8's "no more than 50 questions" cap is **not implemented**, the team
  agreed 60 (5×4×3) was fine instead.

Existing databases need the same reset as before (see backend-structure.md
§11, "Resetting the database"), the new dataset only loads into an empty one.

---

## 1. What changed

### Database

| Before                                                                | After                                                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `CompetenceArea`                                                      | `Competence`, now with a required primary `Source`                                            |
| Questions pointed at a competence area                                | Questions point at a `SectionModule` **and** at the `Competence` they assess                  |
| No content hierarchy                                                  | `Section` → `SectionModule` → main competence (FK) + secondary competences (join table)       |
| Competences and sources unrelated                                     | Primary source (FK) and secondary sources (join table) per competence                         |
| `Learner.role` string plus `roleId`                                   | `roleId` only; `createdAt`/`updatedAt` on most tables                                         |
| A role was only a label                                               | Roles have **allow-lists**: `identity_role_section`, `identity_role_competence`               |
| `courses_course` (`name`, text `credits`, text `confidence`)          | `sources_source` (`courseName`, decimal `credits`, float `confidence`)                        |
| A journey pointed at one competence area                              | A journey covers sections through `journey_section`, each with a coverage level **M / R / S** |
| `learning_journey_module`; `courseId`, `learnerId` were plain strings | `learning_journey_learning_module`; `sourceId` and `learnerId` are real foreign keys          |
| Scores keyed by competence area                                       | `competence_score` keyed by `competenceId` (unique per run)                                   |

Also new: a unique constraint on `(learnerId, instanceNum)` for SAT instances.
Join tables use composite primary keys and cascade on delete.

### Backend

- **Module rename:** `courses` → `sources` (folder, table, route `GET /sources`).
- **Question visibility:** `GET /questions` returns only what the learner's role can
  see (its competence **or** its section is granted; nothing until granted).
- **Question types:** `likert`, `single_choice`, `multi_choice`, `true_false`,
  converted to PIE content by `assessment.pie.ts` (all four use PIE's
  `multiple-choice` element). Likert is new and scores as the value picked.
- **Score roll-up** groups by each question's own `competenceId`.
- **Recommendation** is rewritten: weakest competence → its sections → the journey
  with the best M/R/S coverage of them.
- **Admin routes** (`/admin/visibility` and `PUT`/`DELETE` grants) in
  `identity.admin.routes.ts`.
- **Seeding:** `src/seed/` loads the fake dataset automatically when the database
  has no questions, and `npx prisma db seed` runs the same loader.
- **Robustness:** `lib/asyncHandler.ts` plus an error handler in `server.ts` (a
  failed request is a `500`, not a dead process); `saveResponse` is an atomic
  upsert; creating the first SAT instance survives two requests arriving together.

### Frontend

- `features/courses` → `features/sources` (`SourcesPage`, `SourceCard`); the nav
  item, route and wording are now "Sources" (`/sources`).
- New `features/admin`: `AdminPage` and `GrantChecklist`, at `/admin`.
- The account menu has an **Admin mode** item (new `ShieldIcon`).
- API shapes: `competenceArea` → `competence` on questions and scores; sources
  use `courseName`, decimal `credits` (arrives as a string) and numeric `confidence`
  (shown as "% confidence").
- `PieQuestionPlayer` is unchanged.

---

## 2. Decisions and why

- **Kept PIE rather than writing native widgets.** The player already renders and
  scores multiple-choice, so all four types reuse it and only the content
  builder is new.
- **One section has many modules** (`section_module.sectionId`). This reverses an
  earlier draft that had one module holding many sections.
- **Scores roll up by `question.competenceId`, not through the hierarchy.** It
  avoids ambiguity when a section's modules have different competences.
- **Visibility is OR, deny-by-default.** Granting either a section or a competence
  is enough; a role with no grants sees nothing. Consequence: revoking a section
  does not hide its questions while their competences are still granted.
- **Recommendations pick by section coverage** (M, then R, then S), then by how many
  of the weak competence's sections a journey covers, then by name.
- **`multi_choice` keeps the −1 for a wrong pick** (floored at 0), although the
  seed file's notes say "1 point per correct pick". Without the penalty, ticking
  every box scores full marks. Change the `checkbox` branch of
  `scoreMultipleChoice` if you disagree.
- **`grantedByLearnerId` is nullable** (`SetNull`), so deleting a learner doesn't
  fail because of grants they made.
- **Default roles and the real courses are no longer seeded.** Roles now come from
  the seed, and the four fake roles replace the old persona list. The curated
  courses and open-science questions are still on `dev`
  (`git show dev:backend/prisma/seed.ts`,
  `git show dev:backend/src/modules/courses/courses.bootstrap.ts`).

---

## 3. After you pull this

`prisma/` is baked into the backend image and the schema changed in ways
`prisma db push` cannot apply to an existing database, so **reset once**:

```
docker compose down
docker volume rm customer_driven_gr6_mysql_data
docker compose up -d --build
```

The backend creates the tables and seeds itself on start. This deletes all local
data, including your own learner account and answers, so sign in again and pick a
role. Test roles: _FAKE Everything Taster_ (sees all 30 questions), _FAKE Line Cook_
(18), _FAKE Pastry Wizard_ (18), _FAKE Professional Snack Critic_ (12).

A fresh clone with no existing volume needs no reset.

---

## 4. Open items

- **Admin mode is not secured.** Any signed-in learner with a role can open it and
  edit every role's grants. Gate it on a real admin check (the planned `security`
  module) before real users exist.
- **`db push` is still how the schema is applied.** This change is exactly the
  kind it can't migrate in place; move to Prisma Migrate (`backend-structure.md`
  §7) before there is data worth keeping.
- **The data is fake.** The real curriculum (sections, modules, competences,
  questions, sources) still has to be authored; edit
  `src/seed/data/aios_fake_food_seed.json`.
- **Answers outside a role's visibility still count.** If a learner changes role
  after answering, responses for questions the new role can't see stay in the
  database and in that run's competence totals; only the radar's axes follow the
  current role.
- **`saveResponse` doesn't check visibility**, and an unknown `questionId` returns
  `500` rather than `400`/`404`.
- **Question order is by section, module, then question id.** There are no explicit
  `order` columns. `section.name` is unique across all sections, not per module.
- **`hasCompletedInitialAssessment`** is still set by a separate client call,
  independent of the SAT instance actually completing (unchanged, still a gap).
- **No automated tests.** Verification was scripted and manual (below).

---

## 5. How it was checked

- `tsc`, ESLint and Prettier on both apps: clean, apart from warnings and
  formatting that were already there.
- An end-to-end API script (rows seeded, per-role question counts, all four types,
  in-place re-saving, roll-up and scores, the recommendation, grant/revoke with
  the OR rule, a bad request not crashing the server): all checks passed.
- A headless-browser walkthrough: the whole assessment through the real widgets,
  dashboard and radar, the recommendation card, the Admin mode button, a grant
  change persisting across a reload, the sources page, and phone width (390px)
  without horizontal overflow.

Not covered: real devices, other browsers, load, and concurrent admin edits.

---

## 6. Files

**Backend:** `prisma/schema/{identity,assessment,sources,learningJourney}.prisma`,
`prisma/seed.ts`, `src/index.ts`, `src/server.ts`, `src/lib/asyncHandler.ts`,
`src/seed/`, `src/modules/assessment/{assessment.pie,assessment.scoring,assessment.service,assessment.routes}.ts`,
`src/modules/identity/{identity.service,identity.admin.routes}.ts`,
`src/modules/sources/`, `src/modules/learningJourney/{learningJourney.service,learningJourney.routes}.ts`.
Removed: `roles.bootstrap.ts`, `courses.bootstrap.ts`, `learningJourney.bootstrap.ts`.

**Frontend:** `src/features/admin/`, `src/features/sources/`,
`src/app/layout/{Header,Sidebar}.tsx`, `src/routes.tsx`,
`src/shared/api/endpoints.ts`, `src/shared/components/icons.tsx`, and the
`competence` rename in `features/assessment` and `features/dashboard`.

**Docs:** `context/backend-structure.md`, `context/frontend-structure.md`, and this file.
