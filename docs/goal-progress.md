# Goal Progress

## Current phase

- Phase: 1 - Database Contract and Migrations
- Branch: `feat/11-database-contract`
- Starting main commit for this phase: `404291c608a0b0479fdb3e78af582d720065f409`
- Goal starting commit: `8bfcbb2618e2d7f38ee505fa167fa768c8663153`
- Current state: schema normalization, migration generation, local database verification, reset/seed verification, and the complete local/hosted quality gates are complete; PR #2 is open and awaiting self-review/merge.

## Completed phases

- Phase 0 - Project Truth and Tooling - merged as PR [#1](https://github.com/lucifron28/online-school-fees-system/pull/1), merge commit `404291c608a0b0479fdb3e78af582d720065f409`.

## Pull requests and merges

- PR #1 - [fix: establish truthful project contract and safe Phase 0 tooling](https://github.com/lucifron28/online-school-fees-system/pull/1) - merged with merge commit `404291c608a0b0479fdb3e78af582d720065f409`.
- PR #2 - [feat: establish normalized database contract and migrations](https://github.com/lucifron28/online-school-fees-system/pull/2) - open; current head `8fbb6718ca32ebc7ae7dfa5608b63413761a8020`.
- Phase 1 commits: `4b5068c` (schema/migration), `0655e06` (verification/tooling), `8fbb671` (documentation).

## Phase 1 implementation

- Replaced unrestricted status/method/type text columns with PostgreSQL enums where the domain is closed.
- Added centavo-positive, non-negative, and one-sided ledger checks.
- Added unique ownership, assessment-scope, receipt/payment, reversal/payment, payment-reference, payment-idempotency, checkout-reference, callback-event, and delivery-channel constraints.
- Removed destructive cascades from financial history relationships and added the student-user link while retaining guardian-user links.
- Added annual/semester/trimester/monthly assessment-period support.
- Added persisted mock-payment checkout and callback-event tables.
- Added notification and notification-delivery tables with dedupe and retry state.
- Added portal, reporting, search, and reconciliation indexes.
- Changed financial event timestamps to `timestamp with time zone`.
- Added a migration contract verifier and a local PostgreSQL adapter for seed/reset/integration workflows; remote URLs continue to use Neon.

## Migrations introduced

- `src/db/migrations/0000_good_ghost_rider.sql`
- `src/db/migrations/meta/0000_snapshot.json`
- `src/db/migrations/meta/_journal.json`

## Commands and actual results

| Command                                           | Result                | Notes                                                                                                                                                              |
| ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gh auth status`                                  | Failed                | Cached CLI token is invalid; the connected GitHub app supplied repository push, PR, and merge access.                                                              |
| `pnpm install --frozen-lockfile --ignore-scripts` | Passed                | Lockfile resolved with the Phase 0 tooling and PostgreSQL migration dependencies.                                                                                  |
| `pnpm format:check`                               | Passed                | All repository files match Prettier after the Phase 1 edits.                                                                                                       |
| `pnpm lint`                                       | Passed                | ESLint completed with exit code 0.                                                                                                                                 |
| `pnpm typecheck`                                  | Passed                | Strict TypeScript passed after schema, migration, and local adapter changes.                                                                                       |
| `pnpm test`                                       | Passed                | 11 files and 39 unit/component tests passed.                                                                                                                       |
| `pnpm test:integration`                           | Passed                | 1 file and 3 reset-safety tests passed.                                                                                                                            |
| `pnpm build`                                      | Passed                | Next.js 15.5.21 compiled all 26 routes; expected missing Better Auth secret/base URL warnings remain without deployment environment variables.                     |
| `pnpm test:e2e`                                   | Passed                | Four Chromium smoke tests passed.                                                                                                                                  |
| `pnpm db:generate`                                | Passed                | Generated the initial migration; a subsequent run reported no schema changes.                                                                                      |
| `pnpm db:migrate`                                 | Passed                | Applied the committed migration to fresh isolated PostgreSQL databases `osfs_blank_verify` and `osfs_test_verify`.                                                 |
| `pnpm db:verify:migrations`                       | Passed                | Verified 27 tables, 10 required unique indexes, 10 monetary/check constraints, enum columns, timezone-aware financial timestamps, and financial delete protection. |
| `pnpm db:seed`                                    | Passed                | Seeded the isolated fictional database using the local PostgreSQL adapter.                                                                                         |
| `pnpm db:test:reset`                              | Passed                | Reset and reseeded the separate test database with `TEST_DB_RESET_CONFIRMATION=RESET_TEST_DATABASE`; application and test URLs were different.                     |
| `pnpm db:test:reset` without test configuration   | Passed (safe refusal) | Refused because `TEST_DATABASE_URL` was missing; no database was touched.                                                                                          |
| Foundation CI run #17 (`31254458551`)             | Passed                | Phase 0 CI passed after pinning the workflow to `pnpm 11.17.0`.                                                                                                    |
| Foundation CI run #20 (`31255883562`)             | Passed                | Phase 1 PR CI passed formatting, lint, typecheck, unit tests, build, browser installation, and Playwright.                                                         |

## Remaining work

- Add the Phase 1 self-review comment, merge PR #2 with a merge commit, and synchronize main.
- Implement the Better Auth and RBAC workflow in Phase 2.
- Implement all later phases in the attached goal contract.

## Known blockers

- The local `gh` CLI token remains invalid; GitHub connector access is currently working.
- A real fictional Neon/test PostgreSQL URL is still required for remote deployment verification; local isolated PostgreSQL covers migration and seed checks.

## Next exact action

Add the Phase 1 self-review comment, merge PR #2 only after required checks remain green, and synchronize main before starting Phase 2.
