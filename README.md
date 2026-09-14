# AIOS SAT/LJ — dev scaffold

Minimal starting point for the Self-Assessment and Learning Journey tools:
MySQL + a Node/TypeScript backend (Express + Prisma) + a React/TypeScript
frontend (Vite), wired together with Docker Compose, plus a basic CI check.

This is deliberately small. It does not include the PIE player, Google
OAuth, or the full schema yet — it's the "does everything talk to
everything" slice from sprint 1. Build on top of it.

## Getting started

1. Install Docker Desktop (or Docker Engine + Compose) if you don't have it.
2. Copy the env file: `cp .env.example .env`
3. Start everything: `docker compose up --build`
4. Frontend: http://localhost:5173
5. Backend health check: http://localhost:4000/health
6. MySQL is exposed on localhost:3306 (user/pass in `.env`) if you want to
   connect with a GUI client (TablePlus, DBeaver, etc).

The frontend calls the backend's `/health` endpoint on load and displays
the result — that's the whole "vertical slice" for now: proof that
frontend → backend → (eventually) database are connected end to end.

## Project layout

```
backend/    Express + TypeScript API, Prisma ORM, MySQL schema
frontend/   React + TypeScript, Vite dev server
docker-compose.yml   Runs mysql + backend + frontend together
.github/workflows/ci.yml   Installs deps, lints, and builds both apps on push/PR
```

## Code quality

Both `backend/` and `frontend/` have ESLint (flat config, `eslint.config.js`/`.mjs`)
and Prettier set up, with a shared style at the repo root (`.prettierrc.json`).
Run from either package directory:

```bash
npm run lint           # ESLint — errors fail the build; warnings don't
npm run format:check   # Prettier — verifies formatting, changes nothing
npm run format         # Prettier — rewrites files to match the style
```

The frontend config also enables `eslint-plugin-jsx-a11y`, which statically
flags common keyboard-accessibility mistakes (e.g. a clickable element with
no keyboard handler) as part of the normal lint run.

CI (`.github/workflows/ci.yml`) runs `format:check` and `lint` before
`build` for both packages on every push and pull request to `main`, so a
PR with lint or formatting problems fails before it can be merged.

## Next steps

## Common commands

```bash
docker compose up --build      # start everything, rebuild images
docker compose down             # stop everything
docker compose logs -f backend  # tail backend logs
docker compose exec backend npx prisma studio   # browse the DB in a UI
docker compose exec backend npx prisma migrate dev --name init  # run migrations
```
