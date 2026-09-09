# `app/`

App-wide wiring that isn't tied to one feature: provider composition
(`providers/`), the authenticated layout shell (`layout/`), and route guards
(`guards/`), plus `routes.tsx` at `src/` root.

**Not built yet.** Lands in rollout step 2 (router + `App.tsx` shell) — see
[`context/frontend-structure.md`](../../../context/frontend-structure.md).
Until then `App.tsx` holds the top-level flow directly.
