# AIOS SAT/LJ, dev scaffold

Minimal starting point for the Self-Assessment and Learning Journey tools:
MySQL + a Node/TypeScript backend (Express + Prisma) + a React/TypeScript
frontend (Vite), wired together with Docker Compose, plus a basic CI check.

This is deliberately small. It does not include the PIE player, Google
OAuth, or the full schema yet, it's the "does everything talk to
everything" slice from sprint 1. Build on top of it.

## Getting started

1. Install Docker Desktop (or Docker Engine + Compose) if you don't have it.
2. Copy the env file: `cp .env.example .env`
3. Start everything: `docker compose up --build`. MySQL starts first, then
   `db-init` applies the schema and, into an empty database, loads the content,
   and exits; then the backend and frontend start. After that the content lives
   in the database: admins change it in admin mode → **Edit curriculum**.
4. Frontend: http://localhost:5173
5. Backend health check: http://localhost:4000/health
6. MySQL is exposed on localhost:3306 (user/pass in `.env`) if you want to
   connect with a GUI client (TablePlus, DBeaver, etc).

The frontend calls the backend's `/health` endpoint on load and displays
the result, that's the whole "vertical slice" for now: proof that
frontend → backend → (eventually) database are connected end to end.

## Project layout

```
database/   Everything about the database: the Prisma schema, pre-push.sql,
            the content datasets and the code that loads them (db-init)
backend/    Express + TypeScript API only: routes, services, middleware
frontend/   React + TypeScript, Vite dev server
docker-compose.yml   Runs mysql → db-init (once) → backend → frontend
.github/workflows/ci.yml   Format, lint, test (with coverage) and build each package on push/PR
```

The schema lives in `database/prisma/schema`; the backend generates its own
Prisma client from it (`npm run prisma:generate` in `backend/`, which copies
it into the git-ignored `backend/prisma/`). Change the schema in `database/`
only.

## Code quality

`database/`, `backend/` and `frontend/` have ESLint (flat config, `eslint.config.js`/`.mjs`)
and Prettier set up, with a shared style at the repo root (`.prettierrc.json`).
Run from either package directory:

```bash
npm run lint           # ESLint, errors fail the build; warnings don't
npm run format:check   # Prettier, verifies formatting, changes nothing
npm run format         # Prettier, rewrites files to match the style
```

The frontend config also enables `eslint-plugin-jsx-a11y`, which statically
flags common keyboard-accessibility mistakes (e.g. a clickable element with
no keyboard handler) as part of the normal lint run.

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and
`test:coverage` before `build` for both packages on every push and pull
request to `main` and `dev`, so a PR with lint or formatting problems,
failing tests, or too little test coverage fails before it can be merged.

### Test coverage

Both packages must keep **at least 90%** line, statement, branch and function
coverage. The thresholds live in `database/vitest.config.ts`,
`backend/vitest.config.ts` and `frontend/vite.config.ts`; CI fails below them.

```bash
npm run test:coverage   # tests + coverage report; open coverage/index.html for detail
```

New code comes with tests. The few files excluded from coverage (process
startup, the WebGL robot scene, one-line barrels…) are listed with the reason
in those configs: only code a unit test can't meaningfully run belongs there.

Backend route tests start the real Express app on a random port with the
services mocked; see `backend/src/test/httpTestServer.ts` and any
`*.routes.test.ts` for the pattern.

## Next steps

## Common commands

```bash
docker compose up --build      # start everything, rebuild images
docker compose down             # stop everything
docker compose logs -f backend  # tail backend logs
docker compose logs db-init     # what the last schema push and seed did
docker compose run --rm -p 5555:5555 db-init npx prisma studio --browser none  # browse the DB: http://localhost:5555
docker compose run --rm db-init npm run content:sync              # preview WP2 dataset changes
docker compose run --rm db-init npm run content:sync -- --apply   # apply them (overwrites editor changes to those rows)
```

After changing the schema (`database/prisma/schema`), rebuild both:
`docker compose up -d --build db-init backend`.

### Schema changes that would lose data

db-init applies the schema with `prisma db push`, but never with
`--accept-data-loss`: a change that would drop a column or table, or narrow a
type, makes db-init fail (and the backend stays down) instead of deleting data.
`docker compose logs db-init` shows what would be lost. To apply it on purpose,
back the database up first, then run it once by hand and start again:

```bash
# <database>: the name at the end of DATABASE_URL in .env
docker compose exec mysql sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" <database>' > backup.sql
docker compose run --rm db-init npm run schema:push:accept-data-loss
docker compose up -d
```

`backup*.sql` is git-ignored, and `.dockerignore` keeps dumps out of images.

## Running on the VM (production)

Locally, `docker compose up` runs the Vite dev server with hot reload. On the
VM, add the production override so the frontend is served as a minified build
(a few files instead of one per source file, so pages load far faster):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The `VITE_*` values in `.env` are built into the frontend, so after changing
them, rebuild it (the same command, or `... up -d --build frontend`).

## License

Licensed under the GNU Lesser General Public License v3.0, see [LICENSE](LICENSE).
