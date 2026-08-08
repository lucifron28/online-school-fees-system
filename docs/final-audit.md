# Final Internal Audit Log

## Status

The previous internal-audit document is superseded. Its passing status described static checks and unit-level prototypes, not a clean-database, authenticated, persisted end-to-end workflow. The current goal reopens the audit and requires evidence from migrations, integration tests, authenticated Playwright workflows, CI, and a fictional deployment.

## Reopened findings

| ID      | Area                     | Evidence                                                                                                                                                                                                                 | Status                                                                           |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| AUD-007 | Database reproducibility | Phase 1 adds `src/db/migrations/0000_good_ghost_rider.sql`; it was applied and contract-verified on fresh isolated PostgreSQL databases.                                                                                 | Resolved in Phase 1; remote Neon still requires configured fictional credentials |
| AUD-008 | Authentication           | Phase 2 connects the shared TanStack Form login to Better Auth, disables public sign-up, rejects disabled users, protects layouts/Route Handlers, and verifies sessions/logout with isolated PostgreSQL and HTTP checks. | Resolved in Phase 2; role-specific domain ownership remains later work           |
| AUD-009 | Financial persistence    | Assessment and payment services return `*-simulated-001` identifiers and do not write through Drizzle.                                                                                                                   | Open                                                                             |
| AUD-010 | Ownership                | Parent and student portal helpers accept caller-supplied ownership values instead of querying PostgreSQL.                                                                                                                | Open                                                                             |
| AUD-011 | Mock payment state       | Callback idempotency is stored in a module-level `Map`, so it is not restart-safe.                                                                                                                                       | Open                                                                             |
| AUD-012 | Reporting                | Dashboard metrics are hardcoded constants and do not derive from PostgreSQL.                                                                                                                                             | Open                                                                             |
| AUD-013 | Reset safety             | The former reset command could delete application data without a separate test target or explicit confirmation.                                                                                                          | Resolved in Phase 0; integration-tested                                          |
| AUD-014 | Claims and wording       | Prior docs described prototype screens as complete and used official-receipt wording.                                                                                                                                    | Resolved in Phase 0/1; remaining UI wording is tracked for later repair          |

## Audit rule

No phase may be marked complete solely because formatting, lint, type checking, mocked unit tests, or a production build passes. Completion requires the acceptance evidence in `docs/goal-progress.md`.
