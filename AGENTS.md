Affluvia Financial Planning Application


# Repository Guidelines

## Project Structure & Module Organization
- `server/` — Express API, workers, DB logic, Jest config (`server/jest.config.js`).
- `client/` — React + Vite app (Tailwind). Entry: `client/src/main.tsx`.
- `shared/` — Shared TypeScript models/utilities used by client/server.
- `migrations/` — SQL migrations (Drizzle). `db/` holds config and helpers.
- `scripts/` — Dev/maintenance scripts (TypeScript + shell).
- `docs/`, `uploads/`, `monte_carlo_tests/` — documentation, assets, fixtures.

## Architecture Overview
```mermaid
flowchart LR
  subgraph Client
    C[React (Vite)]
  end
  subgraph Server[Express API (Node/TS)]
    R[Routes & Controllers]
    M[Security & Middleware]
    W[Workers Pool (Piscina)]
  end
  subgraph Data[Data Layer]
    D[Drizzle ORM]
    PG[(PostgreSQL)]
    RS[(Redis Cache)]
  end
  subgraph External[External Services]
    PL[Plaid]
    SB[Supabase]
    AI[OpenAI / Google GenAI]
  end

  C -->|HTTP /api| Server
  Server --> R
  Server --> M
  Server --> W
  R --> D --> PG
  R --> RS
  W --> PG
  W --> RS
  Server -->|sync/webhooks| PL
  Server --> SB
  Server --> AI
```
Keeping this diagram current: when adding routes (`server/routes.ts`), workers (`server/workers/*`), data stores, or new integrations (`server/services/*`), update nodes/edges accordingly in this section.

## Build, Test, and Development Commands
- `npm run dev` — Start API + Vite in dev (`USE_VITE=true`).
- `npm run build` — Build client (Vite) and server (esbuild) to `dist/`.
- `npm start` — Run compiled server from `dist/`.
- `npm run test` | `test:watch` | `test:coverage` — Jest test suite.
- DB: `npm run db:gen` (generate SQL), `db:push` (apply), `db:validate`, `db:studio`, `db:drift`.
- Verification: `npm run ci:verify` (lint + determinism checks).

## Coding Style & Naming Conventions
- TypeScript (ESM). Use 2-space indentation, semicolons, and double quotes.
- File names: kebab-case for `.ts/.tsx` (e.g., `cash-flow-transformer.ts`).
- Prefer small, focused modules; keep route handlers thin and call helpers.
- Determinism: do not use `Math.random`; use `server/rng.ts` (or `deterministic-random.ts`).

## Testing Guidelines
- Unit tests: place in `server/__tests__/**/*.test.ts` (Jest, ts-jest ESM preset).
- Run `npm run test` locally; add coverage when touching core logic.
- Many scenario scripts are `test-*.ts` at repo root/server; run with `tsx` as needed.

## Commit & Pull Request Guidelines
- Use clear, conventional-style messages: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`.
- PRs must include: concise description, linked issue, test plan, and screenshots for UI changes.
- For DB changes, include a migration under `migrations/` and run `npm run db:validate`.
- Ensure `npm run ci:verify` and all tests pass before requesting review.

## Security & Configuration Tips
- Use `.env` for local secrets; never commit secrets. Key vars: `NODE_ENV`, `USE_VITE`, DB creds, Supabase/Plaid/OpenAI keys.
- Dev mode loosens security headers for local testing; do not rely on this in production.
