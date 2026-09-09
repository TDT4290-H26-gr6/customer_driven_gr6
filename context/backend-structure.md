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

| Module | Responsibility | Tables (target names) | Routes |
| --- | --- | --- | --- |
| **`identity`** | who the user is: accounts, Google sign‑in, the persona role picked at onboarding | `identity_learner`, `identity_role`, *(later)* `identity_session` | `POST /auth/google`, `GET /auth/me`, `PUT /auth/me/role`, `GET /roles` |
| **`assessment`** | the question bank, self‑assessment runs, answers, scores | `assessment_competence_area`, `assessment_question`, `assessment_sat_instance`, `assessment_response`, `assessment_competence_score` | `GET /questions`, *(later)* `POST /sat-instances`, `POST /responses`, `GET /results` |
| **`security`** | privileged access and traceability | *(later)* `security_admin`, `security_audit_event`, `security_api_key` | *(later)* `GET/POST /admin/*` |
| **`platform`** | cross‑cutting config | *(later)* `platform_app_setting`, `platform_feature_flag` | — |
| **`health`** | liveness / readiness for ops | — | `GET /health` |

"`identity`" is what the ticket calls *users*; "`assessment`" is what it calls
*questions* (the bank plus everything derived from answering it).

### Cross‑module relationships

Foreign keys **may** cross modules because it is still one database
(`assessment_response.learnerId → identity_learner.id`). The rule is about
*writes*, not the key:

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
│   ├── identity.prisma      # Learner, Role, (Session)
│   ├── assessment.prisma    # CompetenceArea, Question, SatInstance, Response, CompetenceScore
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

| Thing | Rule | Example |
| --- | --- | --- |
| Prisma model | PascalCase singular, no prefix | `SatInstance` |
| Table (`@@map`) | `snake_case`, module prefix | `assessment_sat_instance` |
| Columns | Prisma default camelCase (unchanged for now) | `completedAt` |
| Enum‑like `String` | document allowed values in a `//` comment | `// "self_rating" \| "rubric"` |
| Join / FK field | `<thing>Id` | `competenceAreaId` |

---

## 4. `src/` layout

Mirror the modules; keep framework wiring thin.

```
backend/src/
├── index.ts                 # process entry: start server, run bootstraps
├── server.ts                # buildServer(): express app + router registration
├── db/
│   └── prisma.ts            # the single shared PrismaClient
├── middleware/
│   └── requireAuth.ts       # JWT -> req.learnerId
├── lib/                     # framework-agnostic helpers (jwt, errors, ...)
├── modules/
│   ├── identity/
│   │   ├── identity.routes.ts     # /auth/*, /roles, /auth/me/role
│   │   ├── identity.service.ts    # all Prisma access for identity_* tables
│   │   ├── identity.types.ts
│   │   └── roles.bootstrap.ts     # ensureDefaultRoles() — idempotent seed
│   ├── assessment/
│   │   ├── assessment.routes.ts   # /questions, (later) /responses, /sat-instances
│   │   ├── assessment.service.ts
│   │   └── assessment.types.ts
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
- `*.bootstrap.ts` — idempotent startup data (`ensureDefaultRoles`, future
  `ensureAdmin`), invoked from `index.ts`.
- `server.ts` — imports each module's router and `app.use()`s it. Adding a
  module = one import + one line here.

---

## 5. Import rules

| Layer | May import | Must not import |
| --- | --- | --- |
| `db/`, `lib/` | each other | `modules/` |
| `modules/<x>/` | its own folder, `db/`, `lib/`, `middleware/` | another module's internals |
| `modules/<x>` ↔ `modules/<y>` | the other module's **service** exports only | its routes, its Prisma calls |
| `server.ts`, `index.ts` | every module's routes + bootstraps | — |

---

## 6. Cross-cutting concerns

- **Auth**: `middleware/requireAuth.ts` stays shared; it only decodes the JWT.
  Anything role/permission‑aware lives in `identity` (persona) or `security`
  (privileged access).
- **Errors**: services throw typed errors from `lib/errors.ts`; a single Express
  error handler in `server.ts` maps them to status codes.
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
