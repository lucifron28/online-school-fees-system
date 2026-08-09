# Goal Progress

## Current phase

- Phase: 11 - External-audit preparation
- Branch: `main` (Phase 11 merged; external deployment evidence remains)
- Phase 10 starting main commit: `960f107`
- Goal starting commit: `8bfcbb2618e2d7f38ee505fa167fa768c8663153`
- Current state: Phase 0 through Phase 11 are merged into `main`; external Vercel/Neon preview evidence requires fictional deployment credentials.

## Completed phases

- Phase 0 - Project Truth and Tooling - merged as PR [#1](https://github.com/lucifron28/online-school-fees-system/pull/1), merge commit `404291c608a0b0479fdb3e78af582d720065f409`.
- Phase 1 - Database Contract and Migrations - merged as PR [#2](https://github.com/lucifron28/online-school-fees-system/pull/2), merge commit `fc83f5ee6ea304abe1511a2c63f82c6eb591970b`.
- Phase 2 - Authentication and RBAC - merged as PR [#3](https://github.com/lucifron28/online-school-fees-system/pull/3), merge commit `a21124ca5486d57881bf07cc22f0fb2f35a1ae29`.
- Phase 3 - Core Administration - merged as PR [#4](https://github.com/lucifron28/online-school-fees-system/pull/4), merge commit `e1bfd3d969c80dac552e6a39d7f4ee83c7b833db`.
- Phase 4 - Students, Guardians, and Fees - merged as PR [#5](https://github.com/lucifron28/online-school-fees-system/pull/5), merge commit `c03bb8fe9513e218ec02cba459f4eee49d4d0457`.
- Phase 5 - Assessments and Ledger - merged as PR [#6](https://github.com/lucifron28/online-school-fees-system/pull/6), merge commit `ecb68edb8355fe2115a57a9e41bc51dadf0e005e`.
- Phase 6 - Payments, Receipts, and Audit - merged as PR [#7](https://github.com/lucifron28/online-school-fees-system/pull/7), merge commit `61efc21afd1924716c74481bd10fd3acab559fc2`.
- Phase 7 - Parent/Student Portals and Online Payment - merged as PR [#8](https://github.com/lucifron28/online-school-fees-system/pull/8), merge commit `8984c6f5babc4387833ce53906f688b485172d3b`.
- Phase 8 - Reports and Reconciliation - merged as PR [#9](https://github.com/lucifron28/online-school-fees-system/pull/9), merge commit `1781c11360774c60640b241f5d3b4bb41cb0f479`.
- Phase 9 - Notifications - merged as PR [#10](https://github.com/lucifron28/online-school-fees-system/pull/10), merge commit `d4e2d20f7c35ead9299efc4610f5f9a1dd63fb51`.
- Phase 10 - Demo hardening - merged as PR [#11](https://github.com/lucifron28/online-school-fees-system/pull/11), merge commit `1433cdc4d117340e600ae18d0bb3bfd9e4b2dc7e`.

## Phase 2 implementation

- Configured Better Auth with a Drizzle adapter, explicit base URL/secret handling, email/password sign-in, and `disableSignUp: true` for the public instance.
- Set `role` and `active` additional fields to `input: false`; invalid roles and inactive users fail closed.
- Added a Better Auth sign-in hook that rejects disabled users before a session is created.
- Added a shared TanStack Form + Zod login component for admin, parent, and student screens.
- Redirects are fixed mappings from the stored role: admin/finance to `/admin/dashboard`, parent to `/parent/dashboard`, and student to `/student/dashboard`.
- Added server layout guards, exact parent/student role checks, student portal feature-flag enforcement, and logout that revokes the session.
- Added finance/admin protection to the CSV report and receipt PDF Route Handlers. Health, Better Auth, and the mock payment webhook remain intentionally public integration boundaries.
- Reworked demo seeding to use Better Auth sign-up/password hashing utilities and the required fictional accounts/password.
- Added `pnpm auth:verify` for direct Better Auth acceptance checks and fixed-role routing tests.

## Commands and actual results

| Command                                                                                                          | Result | Notes                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`                                                                                              | Passed | Prettier passed locally and in hosted Foundation CI.                                                                                                                           |
| `pnpm typecheck`                                                                                                 | Passed | Strict TypeScript passed after auth, layout, seed, test, and E2E changes.                                                                                                      |
| `pnpm lint`                                                                                                      | Passed | ESLint completed with exit code 0 locally and in hosted Foundation CI.                                                                                                         |
| `pnpm test`                                                                                                      | Passed | 12 unit/component files and 41 tests passed; Phase 2 adds fixed role-routing coverage.                                                                                         |
| `pnpm test:integration`                                                                                          | Passed | 1 integration file and 3 reset-safety tests passed.                                                                                                                            |
| `pnpm test:e2e`                                                                                                  | Passed | 4 Playwright smoke tests passed locally and in hosted Foundation CI after protected-route expectations were updated.                                                           |
| `pnpm build`                                                                                                     | Passed | Next.js 15.5.21 compiled all 26 routes locally and in hosted Foundation CI with the production auth environment configured.                                                    |
| `pnpm db:migrate`                                                                                                | Passed | Applied the committed migration to isolated `osfs_auth_phase2` PostgreSQL.                                                                                                     |
| `pnpm db:seed`                                                                                                   | Passed | Created and idempotently updated all four demo accounts using Better Auth-compatible password hashing.                                                                         |
| `pnpm auth:verify`                                                                                               | Passed | Verified four demo sign-ins, stored roles, invalid credentials, disabled-user rejection, session persistence, logout, and public sign-up rejection.                            |
| HTTP role/route matrix                                                                                           | Passed | All four accounts signed in; admin/finance report access returned `200`; parent/student cross-role report access returned `403`; unauthenticated report access returned `401`. |
| HTTP logout and feature flag                                                                                     | Passed | Logout removed report access; disabling the student portal redirected both public and authenticated student routes to the fixed unauthorized page.                             |
| Hosted Foundation CI run [#27](https://github.com/lucifron28/online-school-fees-system/actions/runs/31259066634) | Passed | Formatting, lint, typecheck, unit tests, production build, and Playwright E2E all passed on Phase 2 head `95845d6cbba1732891852acc439768a3580a7283`.                           |

## Pull request evidence

Phase 2 was implemented on `feat/12-auth-rbac` in commits `8c03bb2`, `8cc1e9f`, `3e8b0f7`, and `95845d6`, reviewed in PR [#3](https://github.com/lucifron28/online-school-fees-system/pull/3), CI-verified by run [#27](https://github.com/lucifron28/online-school-fees-system/actions/runs/31259066634), and merged with regular merge commit `a21124ca5486d57881bf07cc22f0fb2f35a1ae29`.

## Phase 3 implementation

- Replaced fixed institution settings and user-directory state with PostgreSQL-backed administration services and Route Handlers.
- Added a singleton settings key, valid school-year date check, single-active-school-year index, transactional activation, grade-level/section administration, and archived-year section protection.
- Added exact `ADMIN` guards for settings/users pages and all administration APIs. Finance staff retain the broader admin layout but cannot manage administration.
- Added supported server-side Better Auth account creation, role changes, activation/deactivation, self-protection, and last-active-administrator protection.
- Added loading, empty, error, retry, confirmation, and success states to the settings and user-management screens.

## Phase 3 commands and actual results

| Command                     | Result | Notes                                                                                                                                                                                                                                             |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate`          | Passed | Generated `src/db/migrations/0001_clean_rictor.sql` and snapshot metadata for singleton settings, school-year uniqueness, and date validation.                                                                                                    |
| `pnpm db:migrate`           | Passed | Applied to isolated local PostgreSQL database `osfs_admin_phase3`.                                                                                                                                                                                |
| `pnpm db:verify:migrations` | Passed | Verified 27 tables, 10 unique indexes, 10 checks, and financial delete protection.                                                                                                                                                                |
| `pnpm db:seed`              | Passed | Seeded the isolated database with the demo institution, active school year, academic structure, and four Better Auth accounts.                                                                                                                    |
| `pnpm admin:verify`         | Passed | Verified settings persistence, student-portal flag persistence, school-year lifecycle, academic structure constraints, account roles, and disabled-account sign-in rejection; generated records were cleaned up and original seed state restored. |
| `pnpm typecheck`            | Passed | Strict TypeScript passed for all Phase 3 routes, services, components, scripts, and tests.                                                                                                                                                        |
| `pnpm lint`                 | Passed | ESLint completed with exit code 0.                                                                                                                                                                                                                |
| `pnpm test`                 | Passed | 13 unit/component files and 45 tests passed.                                                                                                                                                                                                      |
| `pnpm test:integration`     | Passed | 1 integration file and 3 reset-safety tests passed.                                                                                                                                                                                               |
| `pnpm build`                | Passed | Next.js 15.5.21 production build generated 31 routes.                                                                                                                                                                                             |
| HTTP admin role matrix      | Passed | Unauthenticated settings access returned `401`; administrator sign-in/settings access returned `200`; finance-staff settings access returned `403`.                                                                                               |
| `pnpm test:e2e`             | Passed | 4 Playwright smoke tests passed locally after removing a stale port-3000 process.                                                                                                                                                                 |

## Phase 3 pull request evidence

Phase 3 was implemented on `feat/13-core-administration` in commits `f1ef27e` and `9232c58`, reviewed in PR [#4](https://github.com/lucifron28/online-school-fees-system/pull/4), CI-verified by run [#33](https://github.com/lucifron28/online-school-fees-system/actions/runs/31261327418), and merged with regular merge commit `e1bfd3d969c80dac552e6a39d7f4ee83c7b833db`. Hosted CI passed formatting, lint, typecheck, 45 unit tests, production build, and Playwright E2E.

## Phase 4 implementation

- Replaced hardcoded student, guardian, fee-category, and fee-structure arrays with PostgreSQL-backed services and guarded Route Handlers.
- Added student lifecycle management, duplicate student-number protection, optional `STUDENT` account links, guardian records, optional `PARENT` account links, primary guardian handling, and duplicate-link protection.
- Added fee-category lifecycle management and draft/active/archived fee structures with item validation, active-school-year/category checks, and archive-only mutation after a posted assessment exists.
- Added TanStack Form + shared Zod validation, TanStack Table, TanStack Query, loading/empty/error/retry/confirmation/success states, URL search/filter/sort/direction/pagination controls, and a live student detail screen.
- Added the `students-fees:verify` isolated-database contract verifier and unit coverage for normalization, required fee items, update validation, and guardian-link defaults.

## Phase 4 commands and actual results

| Command / check             | Result | Notes                                                                                                                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`            | Passed | Strict TypeScript passed for the Phase 4 services, Route Handlers, pages, forms, tables, verifier, and tests.                                                                    |
| `pnpm lint`                 | Passed | ESLint completed with exit code 0 and no warnings.                                                                                                                               |
| `pnpm test`                 | Passed | 13 unit/component files and 43 tests passed.                                                                                                                                     |
| `pnpm test:integration`     | Passed | Reset-safety integration suite passed: 1 file and 3 tests.                                                                                                                       |
| `pnpm db:migrate`           | Passed | Applied the committed migrations to isolated local PostgreSQL database `osfs_phase4`.                                                                                            |
| `pnpm db:seed`              | Passed | Seeded the isolated database with reference academic data and four Better Auth demo accounts.                                                                                    |
| `pnpm db:verify:migrations` | Passed | Verified 27 tables, 10 unique indexes, 10 checks, and financial delete protection.                                                                                               |
| `pnpm auth:verify`          | Passed | Re-verified demo sign-in, invalid credentials, disabled users, sessions, logout, and public sign-up rejection on `osfs_phase4`.                                                  |
| `pnpm students-fees:verify` | Passed | Verified persistence, account-role links, duplicate student numbers/guardian links, draft-active lifecycle, posted-assessment edit lock, safe archive, and cleanup.              |
| HTTP authorization matrix   | Passed | Unauthenticated access returned `401`; parent/student enumeration and mutation returned `403`; admin and finance-staff reads returned `200`; sort/filter queries returned `200`. |
| `pnpm build`                | Passed | Next.js 15.5.21 production build compiled the Phase 4 routes and pages.                                                                                                          |
| `pnpm test:e2e`             | Passed | 4 Playwright smoke tests passed against the local production server.                                                                                                             |

## Phase 4 pull request evidence

Phase 4 was implemented on `feat/14-students-guardians-fees` in commit `496ee86d384011f65ff5e607f5627b11ae9202d7`, reviewed in PR [#5](https://github.com/lucifron28/online-school-fees-system/pull/5), self-reviewed with no blocking findings, CI-verified by run [#37](https://github.com/lucifron28/online-school-fees-system/actions/runs/31263570390), and merged with regular merge commit `c03bb8fe9513e218ec02cba459f4eee49d4d0457`. Hosted Foundation CI passed formatting, lint, typecheck, 43 unit tests, production build, and Playwright E2E.

## Phase 5 implementation

- Replaced the simulated assessment service with PostgreSQL-backed assessment generation, authoritative active fee-structure loading, immutable item snapshots, transactional assessment ledger posting, and duplicate-period protection.
- Added ledger-authoritative student balances, reason-required debit/credit adjustments, over-credit protection, and audit events for assessment posting and adjustments.
- Added guarded assessment and adjustment Route Handlers plus persisted assessments and ledger entries to the admin student profile.
- Added `assessments-ledger:verify`, which exercises persistence, snapshot immutability, duplicate rollback, balance reconciliation, audit records, over-credit rejection, and a forced post-insert transaction rollback.

## Phase 5 commands and actual results

| Command / check                  | Result | Notes                                                                                                                                                                                       |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                 | Passed | Strict TypeScript passed with the database service, Route Handlers, profile component, and verifier.                                                                                        |
| `pnpm lint`                      | Passed | ESLint completed with exit code 0.                                                                                                                                                          |
| Focused Prettier check           | Passed | All Phase 5 files use repository Prettier formatting; the repository-wide local check still reports 82 pre-existing files.                                                                  |
| `vitest run`                     | Passed | 13 unit/component files and 43 tests passed with elevated read access required by the local sandbox.                                                                                        |
| `pnpm assessments-ledger:verify` | Passed | Isolated `osfs_phase4` PostgreSQL verified authoritative posting, immutable snapshots, duplicate prevention, adjustments, audit rows, and full rollback; generated records were cleaned up. |

## Phase 5 pull request evidence

Phase 5 was implemented on `feat/15-assessments-ledger` in commits `e274f9b`, `ee7b048`, and `b781b59`, self-reviewed in PR [#6](https://github.com/lucifron28/online-school-fees-system/pull/6), CI-verified by run [#43](https://github.com/lucifron28/online-school-fees-system/actions/runs/31264884903), and merged with regular merge commit `ecb68edb8355fe2115a57a9e41bc51dadf0e005e`. Hosted Foundation CI passed formatting, lint, typecheck, 43 unit tests, production build, and Playwright E2E.

## Phase 6 implementation

- Replaced the simulated OTC payment service with a PostgreSQL-backed transaction for CASH and BANK_DEPOSIT payments.
- Added authoritative oldest-assessment-item allocation, server-side overpayment rejection, database UUID payment identifiers, unique idempotency handling, persisted allocations, ledger entries, receipts, and audit events.
- Added persisted payment detail/list APIs, receipt PDF generation from stored receipt/allocation data, and compensating reversals that preserve the original payment, void the receipt, and restore the balance.
- Connected the manual-payment, transaction-list, and transaction-detail screens to the new Route Handlers with loading, error, success, receipt, and reversal states.
- Added `payments-receipts:verify`, covering partial payments, allocation order, duplicate and concurrent submissions, overpayment rejection, reversal, receipt PDF status, transaction status, audit events, and cleanup.

## Phase 6 commands and actual results

| Command / check                                    | Result | Notes                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                                   | Passed | Strict TypeScript passed for payment schemas, service, APIs, UI, PDF route, and verifier.                                                                                                                                                  |
| `pnpm lint`                                        | Passed | ESLint completed with exit code 0.                                                                                                                                                                                                         |
| Focused Prettier check                             | Passed | All Phase 6 implementation and verifier files use repository formatting.                                                                                                                                                                   |
| `vitest run`                                       | Passed | 13 unit/component files and 43 tests passed.                                                                                                                                                                                               |
| `vitest run --config vitest.integration.config.ts` | Passed | 1 integration file and 3 reset-safety tests passed.                                                                                                                                                                                        |
| PostgreSQL prerequisite verifiers                  | Passed | Migration, auth, students/fees, and assessments/ledger verifiers passed against isolated `osfs_phase4`.                                                                                                                                    |
| `pnpm payments-receipts:verify`                    | Passed | Isolated PostgreSQL verified partial cash allocation, bank-deposit persistence, idempotency under concurrent duplicate requests, authoritative overpayment rejection, reversal restoration, voided receipt PDF data, and audit visibility. |
| `pnpm build`                                       | Passed | Next.js 15.5.21 production build generated 38 routes; only the temporary low-entropy verification secret warning appeared.                                                                                                                 |
| HTTP authorization/payment matrix                  | Passed | Unauthenticated admin payment and receipt requests returned `401`; admin sign-in and payment listing returned `200`; parent sign-in returned `200` but admin payment access returned `403`.                                                |
| `playwright test`                                  | Passed | 4 Chromium smoke tests passed against the current production server.                                                                                                                                                                       |

## Remaining work

- Supply fictional Neon/Vercel deployment credentials and capture the external preview smoke-test evidence.

## Phase 7 implementation

- Replaced caller-supplied parent/student ownership lists with PostgreSQL queries through guardian/student account relationships.
- Connected parent and student dashboards, account, history, child-detail, receipt, and payment screens to persisted Route Handlers; portal receipt PDFs enforce ownership server-side.
- Replaced module-level mock-payment state with persisted checkout and callback-event records. Checkout amount and student authority come from the stored server record, not the browser return URL or callback body.
- Added delayed, failed, cancelled, successful, and duplicate callback handling. Only a server-verified successful callback calls the shared `PaymentService` with `MOCK_ONLINE`; non-success outcomes do not change the ledger.
- Added `portals-online:verify` for database ownership, checkout idempotency, callback idempotency, restart-safe verification, payment/receipt persistence, and cleanup. No new migration was required because the committed schema already contained the mock checkout and callback-event tables.

## Phase 7 commands and actual results

| Command / check                                    | Result | Notes                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                   | Passed | Strict TypeScript passed for portal services, APIs, pages, payment gateway changes, and verifiers.                                                                                                                                                                    |
| `pnpm lint`                                        | Passed | ESLint completed with exit code 0 and no warnings.                                                                                                                                                                                                                    |
| Focused Prettier check                             | Passed | All Phase 7 implementation, test, verifier, and documentation files use repository formatting.                                                                                                                                                                        |
| `vitest run`                                       | Passed | 13 unit/component files and 41 tests passed.                                                                                                                                                                                                                          |
| `vitest run --config vitest.integration.config.ts` | Passed | 1 integration file and 3 reset-safety tests passed.                                                                                                                                                                                                                   |
| PostgreSQL prerequisite verifiers                  | Passed | Migration, auth, students/fees, assessments/ledger, and payments/receipts verifiers passed against isolated `osfs_phase4`.                                                                                                                                            |
| `pnpm portals-online:verify`                       | Passed | Isolated PostgreSQL verified parent/student ownership, unlinked access rejection, persisted checkout/callback state, success/failure/cancellation/pending behavior, duplicate callbacks, restart-safe verification, and cleanup.                                      |
| `pnpm build`                                       | Passed | Next.js 15.5.21 production build generated 43 routes; only the expected temporary low-entropy verification-secret warning appeared.                                                                                                                                   |
| HTTP portal authorization matrix                   | Passed | Unauthenticated parent access returned `401`; parent access returned `200`; missing parent checkout returned `404`; student account without a linked demo fixture returned `400`; admin access to parent data returned `403`; invalid public callback returned `404`. |
| `playwright test`                                  | Passed | 4 Chromium smoke tests passed against the Phase 7 production build.                                                                                                                                                                                                   |

## Phase 7 pull request evidence

Phase 7 was implemented on `feat/17-portals-online-payment` from main commit `8664e39` in commits `497a90b`, `7a51f2b`, and `1885237`, with documentation commit `776847d`. It was self-reviewed in PR [#8](https://github.com/lucifron28/online-school-fees-system/pull/8), CI-verified by Foundation run [#51](https://github.com/lucifron28/online-school-fees-system/actions/runs/31268864899), and merged with regular merge commit `8984c6f5babc4387833ce53906f688b485172d3b`. Hosted CI passed formatting, lint, typecheck, 41 unit tests, production build, and Playwright E2E. Local isolated PostgreSQL verifiers and the authenticated portal HTTP matrix also passed.

## Phase 8 implementation

- Replaced hardcoded dashboard metrics with PostgreSQL-backed active-student, net-collection, outstanding-balance, posted-transaction, recent-transaction, collection-trend, and payment-method queries.
- Added date-range collection/payment-history, outstanding-balance, reversal, payment-method, grade-level, and student-statement report services and guarded Route Handlers using Asia/Manila boundaries.
- Added CSV exports from the same report datasets used on screen, with spreadsheet-formula injection protection for every cell.
- Added reconciliation status and notes derived from persisted payment, allocation, receipt, and reversal state; reversed payments remain visible in audit reports but are excluded from net collections.
- Added PDF student statement generation from persisted ledger entries and student data.
- Added `reports-reconciliation:verify`, which proves dashboard changes after payment/reversal, net-total exclusion, reversal retention, outstanding and statement reconciliation, breakdowns, CSV output, and PDF generation.

## Phase 8 commands and actual results

| Command / check                                    | Result | Notes                                                                                                                                                                                                                  |
| -------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                   | Passed | Strict TypeScript passed for report services, APIs, dashboard/report pages, statement PDF generation, and verifier.                                                                                                    |
| `pnpm lint`                                        | Passed | ESLint completed with exit code 0.                                                                                                                                                                                     |
| Focused Prettier check                             | Passed | Phase 8 source, tests, verifier, package script, and documentation use repository formatting.                                                                                                                          |
| `vitest run`                                       | Passed | 13 unit/component files and 41 tests passed, including CSV formula protection and Manila date-boundary coverage.                                                                                                       |
| `vitest run --config vitest.integration.config.ts` | Passed | 1 integration file and 3 reset-safety tests passed.                                                                                                                                                                    |
| `pnpm reports-reconciliation:verify`               | Passed | Isolated PostgreSQL verified dashboard/payment/reversal changes, net collections, retained reversal report, outstanding balances, statements, payment-method/grade breakdowns, CSV output, statement PDF, and cleanup. |
| Production build                                   | Passed | Next.js 15.5.21 generated 47 routes, including summary, collections, outstanding, reversals, statement JSON, statement PDF, and CSV routes.                                                                            |
| HTTP report authorization matrix                   | Passed | Unauthenticated report access returned `401`; admin and finance summary access returned `200`; parent and student access returned `403`; authorized CSV returned `200`; missing statement returned `404`.              |
| `playwright test`                                  | Passed | 4 Chromium smoke tests passed against the Phase 8 production build.                                                                                                                                                    |

## Phase 8 pull request evidence

Phase 8 was implemented on `feat/18-reports-reconciliation` from main commit `b3fae78` in commits `ed6c151`, `5f69cb1`, and `f68b414`, with documentation commit `92d80c4`. It was self-reviewed in PR [#9](https://github.com/lucifron28/online-school-fees-system/pull/9), CI-verified by Foundation run [#55](https://github.com/lucifron28/online-school-fees-system/actions/runs/31270204436), and merged with regular merge commit `1781c11360774c60640b241f5d3b4bb41cb0f479`. Hosted CI passed formatting, lint, typecheck, 41 unit tests, production build, and Playwright E2E. Local isolated PostgreSQL verifier, HTTP authorization matrix, and statement PDF checks also passed.

## Phase 6 pull request evidence

Phase 6 was implemented on `feat/16-payments-receipts-audit` in commits `2d474ec`, `7994726`, `1b70655`, and `b3186f5`, self-reviewed in PR [#7](https://github.com/lucifron28/online-school-fees-system/pull/7), CI-verified by run [#47](https://github.com/lucifron28/online-school-fees-system/actions/runs/31266704319), and merged with regular merge commit `61efc21afd1924716c74481bd10fd3acab559fc2`. Hosted Foundation CI passed formatting, lint, typecheck, 43 unit tests, production build, and Playwright E2E. The required isolated PostgreSQL payment verifier and authenticated HTTP matrix also passed locally.

## Known blockers

- The local `gh` CLI token remains invalid; the connected GitHub app is required for PR creation, review, and merge.
- A configured hosted PostgreSQL environment is still required for Round 1 concurrency, verifier, and authenticated browser evidence; the local Windows checkout has no usable `TEST_DATABASE_URL` or Docker PostgreSQL service.
- External Vercel/Neon preview credentials are still required for deployment evidence. The committed seed now contains deterministic fictional walkthrough data: 20 students, 10 guardians, persisted links, financial fixtures, mock checkout outcomes, and notification history.

## Phase 9 implementation

- Added the provider-neutral `EmailProvider` interface with a configured Resend implementation and a console fallback when `RESEND_API_KEY` and `EMAIL_FROM` are unavailable.
- Added persisted, recipient-scoped notification dispatch for assessment posting, successful payment, receipt availability, and payment reversal. Due reminders remain intentionally unimplemented because no confirmed due-date requirement exists.
- Added database-backed delivery state transitions (`PENDING`, `RETRYING`, `SENT`, and `FAILED`), attempt counts, retry timestamps, provider IDs, and failure messages. Manual retries are available to administrators and finance staff.
- Added unique recipient/event dedupe keys so repeated payment requests and mock callback replays do not create duplicate messages. Notification dispatch runs after financial commits and catches provider failures so financial success is not rolled back.
- Added authenticated notification APIs and role-scoped history pages. Admin/finance users can audit all notification history; parent and student users can retrieve only their own records.
- Added `notifications:verify`, which exercises assessment/payment/receipt/reversal triggers, linked student/guardian recipients, console delivery, failed Resend-style delivery and retries, financial success despite email failure, duplicate payment submission, duplicate mock callback replay, and cleanup.

## Phase 9 commands and actual results

| Command / check                     | Result              | Notes                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                    | Passed              | Strict TypeScript passed after notification service, provider, API, UI, payment, assessment, gateway, and verifier changes.                                                                                                                    |
| `pnpm lint`                         | Passed              | ESLint completed with exit code 0.                                                                                                                                                                                                             |
| `pnpm test`                         | Passed              | 14 unit/component files and 44 tests passed, including provider selection and notification schema coverage.                                                                                                                                    |
| `pnpm test:integration`             | Passed              | 1 integration file and 3 reset-safety tests passed.                                                                                                                                                                                            |
| `pnpm notifications:verify`         | Passed              | Isolated PostgreSQL verified persisted event history, recipient dedupe, console fallback, provider failures/retries, financial success despite delivery failure, reversal notifications, duplicate payments, duplicate callbacks, and cleanup. |
| `pnpm build`                        | Passed              | Next.js 15.5.21 production build generated 51 routes, including notification history and retry APIs/pages.                                                                                                                                     |
| `pnpm test:e2e`                     | Passed              | 4 Chromium smoke tests passed after restarting a repository-owned stale Next.js server; the clean-server rerun exited 0.                                                                                                                       |
| Focused Prettier check              | Passed              | All Phase 9 source, tests, verifier, package-script, and modified documentation files pass the repository's local Prettier binary.                                                                                                             |
| Repository-wide `pnpm format:check` | Passed in hosted CI | Hosted Foundation CI run #61 passed the full repository formatter; the local Windows checkout still reports legacy newline differences in 126 unrelated files.                                                                                 |

## Phase 9 pull request evidence

Phase 9 was implemented on `feat/19-notifications` in commits `901ac5a`, `39f6886`, `22ebf4a`, `373f7de`, and `4c4ac23`, with CI-formatting fix `d29044c`. It was self-reviewed in PR [#10](https://github.com/lucifron28/online-school-fees-system/pull/10); initial Foundation run [#59](https://github.com/lucifron28/online-school-fees-system/actions/runs/31272071975) identified only Markdown formatting in two modified evidence files, and rerun [#61](https://github.com/lucifron28/online-school-fees-system/actions/runs/31272154634) passed formatting, lint, typecheck, unit tests, production build, and Playwright E2E. The PR was merged with regular merge commit `d4e2d20f7c35ead9299efc4610f5f9a1dd63fb51` and `main` was synchronized.

## Phase 10 implementation

- Replaced the minimal seed with deterministic fictional data: one active school year, six grades, twelve sections, four role accounts, 20 students, 10 guardians, persisted guardian/student and student/user links, fee categories and structures, posted assessments, unpaid/partial/fully-paid states, cash/bank/mock-online payments, one reversal, receipts, audit rows, notifications/deliveries, and succeeded/failed/cancelled checkout fixtures.
- Made seed reruns converge on stable demo identifiers, business keys, payment idempotency keys, receipt numbers, and notification event keys.
- Added PostgreSQL integration coverage for authentication, settings, academic/student/guardian/fee persistence, assessment duplicate protection, ledger balances, payment allocations, receipt/reversal state, portal ownership, checkout states, notifications, and report totals.
- Added the authenticated admin/finance/parent/student Playwright workflow, including setup, partial cash payment, parent ownership, mock callback replay, student isolation, reversal/voided receipt, report/PDF checks, and unauthorized API checks.
- Added dedicated PostgreSQL application/test databases to Foundation CI, migration and seed steps, safe test reset/seed, integration execution, and the existing build/E2E stages.

## Phase 10 commands and actual results

| Command / check                                                                                           | Result      | Notes                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd lint`                                                                                           | Passed      | ESLint completed with exit code 0 after the final E2E contract fix.                                                                                                          |
| `pnpm.cmd typecheck`                                                                                      | Passed      | Strict TypeScript completed with exit code 0 after the final E2E contract fix.                                                                                               |
| `pnpm.cmd test`                                                                                           | Passed      | 14 unit/component files and 44 tests passed locally.                                                                                                                         |
| `pnpm.cmd test:integration`                                                                               | Passed      | Reset-safety tests passed locally; the database contract is skipped without local `TEST_DATABASE_URL`.                                                                       |
| `pnpm.cmd build`                                                                                          | Passed      | Next.js production build generated 51 routes locally.                                                                                                                        |
| `pnpm.cmd test:e2e`                                                                                       | Hosted only | The local Windows checkout lacks the Playwright CLI; Foundation CI provided the browser evidence.                                                                            |
| Foundation CI run [#68](https://github.com/lucifron28/online-school-fees-system/actions/runs/31274402661) | Passed      | Migrations, fictional seed, safe reset/seed, formatting, lint, typecheck, 44/44 unit tests, database integration tests, production build, and all 5 Playwright tests passed. |

## Phase 10 pull request evidence

Phase 10 was implemented on `test/20-demo-hardening` from main commit `960f107` in commits `0cc0108`, `f17c1f0`, `4f9d05b`, `9d93b56`, `d529d36`, `44bbde5`, and `6b66617`. It was self-reviewed in PR [#11](https://github.com/lucifron28/online-school-fees-system/pull/11) with no inline review threads or blocking findings, CI-verified by Foundation run [#68](https://github.com/lucifron28/online-school-fees-system/actions/runs/31274402661), and merged with regular merge commit `1433cdc4d117340e600ae18d0bb3bfd9e4b2dc7e`. Vercel/Neon preview deployment remains pending fictional external credentials.

## Phase 11 implementation

- Audited the full auth, authorization, session, schema, migration, financial, ownership, notification, reporting, reset/seed, error-handling, accessibility, responsive, documentation, and CI surface with CodeGraph and targeted static checks.
- Repaired fabricated hub/role-switcher student, receipt, and transaction links; removed parent/student sidebar destinations without implemented pages; and kept acknowledgment-receipt wording fictional and non-official.
- Replaced the reports verifier's temporary `Math.random()` suffix with `crypto.randomUUID()`.
- Added PostgreSQL row locks for payment/reversal student mutations and mock-checkout callback locking with terminal-success downgrade protection.
- Added clean-database integration coverage for concurrent payment serialization, overpayment rejection, and conflicting callback state.

## Phase 11 audit findings and disposition

| Finding                                                             | Severity               | Result                                                                                                    |
| ------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Concurrent payments could read one balance before commit            | HIGH                   | Fixed with a student-row lock; CI integration test passed with exactly one competing payment accepted.    |
| Late failed/cancelled callback could downgrade a succeeded checkout | HIGH                   | Fixed with checkout-row locking and terminal-state protection; CI integration test passed.                |
| Fabricated IDs, dead navigation, and stale official-receipt wording | MEDIUM / demo-critical | Fixed; static audit found no remaining fabricated IDs or dead sidebar destinations.                       |
| Temporary verifier used `Math.random()`                             | LOW                    | Fixed with `crypto.randomUUID()`; no production financial identifier used `Math.random()`.                |
| Vercel/Neon preview credentials unavailable                         | External blocker       | Application and CI evidence complete; external deployment remains pending required fictional credentials. |

## Phase 11 commands and actual results

| Command / check                                                                                           | Result | Notes                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codegraph.cmd explore` audit queries                                                                     | Passed | Traced parent ownership, payment checkout/callback, authentication, schema constraints, and report blast radius before source review.                                                         |
| Targeted static audit searches                                                                            | Passed | No application `simulated-001`, `Math.random()` financial ID, fabricated route ID, `href="#"`, unauthenticated application route, `@ts-ignore`, `.only`, `TODO`, or `FIXME` finding remained. |
| `pnpm.cmd typecheck`                                                                                      | Passed | Strict TypeScript passed after row-lock, callback, navigation, and integration-test changes.                                                                                                  |
| `pnpm.cmd lint`                                                                                           | Passed | ESLint completed with exit code 0.                                                                                                                                                            |
| `pnpm.cmd test`                                                                                           | Passed | 14 unit/component files and 44 tests passed.                                                                                                                                                  |
| Focused Prettier check                                                                                    | Passed | All seven Phase 11 changed files passed the repository formatter.                                                                                                                             |
| `pnpm.cmd test:integration`                                                                               | Passed | Local reset-safety tests passed; the four PostgreSQL workflow tests are skipped locally without `TEST_DATABASE_URL`.                                                                          |
| `pnpm.cmd build`                                                                                          | Passed | Next.js production build completed locally; CI supplied the configured auth environment.                                                                                                      |
| Foundation CI run [#72](https://github.com/lucifron28/online-school-fees-system/actions/runs/31275665685) | Passed | Fresh PostgreSQL migrations, seed, safe reset/seed, formatting, lint, typecheck, 44 unit tests, database integration tests, production build, and all Playwright smoke tests passed.          |

## Phase 11 pull request evidence

Phase 11 was implemented on `fix/21-external-audit-preparation` in commit `719df07b1a8f6e41643ee8c06dbb2868ce9a08e5`, self-reviewed in PR [#12](https://github.com/lucifron28/online-school-fees-system/pull/12) with review ID `4889598638` and no inline review threads, CI-verified by Foundation run [#72](https://github.com/lucifron28/online-school-fees-system/actions/runs/31275665685), and merged with regular merge commit `407cb8f18c207f648ca57c7f88c2c78d8f0728cf`. External Vercel/Neon preview evidence remains the only outstanding environment prerequisite.

## External Audit Repair Round 1 implementation

- Added one shared student-row lock invariant for assessment posting, assessment adjustments, CASH/BANK_DEPOSIT/MOCK_ONLINE payment posting, and payment reversals. Every path locks before reading or writing ledger state inside its transaction.
- Added a PostgreSQL receipt sequence keyed by persisted school prefix and calendar year. Allocation is transaction-local, timezone-aware for `Asia/Manila`, database-backed, and formatted as `<PREFIX>-<YEAR>-<SEQUENCE>`.
- Changed parent/student account summaries and dashboard wording to show net payments: `PAYMENT` credits less `REVERSAL` debits. Reversal history remains separately visible.
- Made notification delivery claiming atomic, made `SENT` terminal, retained per-attempt history, and added a fake-provider concurrent manual-retry test. This scope has no scheduler; `PENDING` is the retryable state.
- Added a browser-only Playwright scenario for visible admin student/assessment setup, finance CASH posting and receipt PDF, parent payment history, and student account/history. The existing API-heavy workflow remains unchanged.
- Added a clear lazy runtime error when `DATABASE_URL` is absent, preserving build/import safety without a placeholder database URL.
- Tightened the intentionally public mock callback boundary: input cannot choose student/amount/method, stored checkout values are authoritative, references are persisted and unguessable, duplicate event/idempotency keys are guarded, unknown references fail, and terminal states cannot be reopened.
- Updated the README, architecture, progress/findings/audit records, and Foundation CI. CI reruns the deterministic seed and executes all PostgreSQL contract verifiers before the integration, build, and browser stages.

## External Audit Repair Round 1 findings and disposition

| Finding                                                          | Severity     | Disposition on this branch                                                                         |
| ---------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Student-row serialization across all ledger mutations            | HIGH         | Implemented; clean PostgreSQL concurrency cases passed in hosted Foundation CI run #102.           |
| Database-backed, Manila-year receipt sequence                    | MEDIUM       | Implemented with migration, unit tests, and clean PostgreSQL concurrency cases passed in run #102. |
| Reversal-aware parent net payments                               | MEDIUM       | Implemented; unit, integration, and hosted workflow coverage passed in run #102.                   |
| Atomic notification retry claiming and attempt history           | MEDIUM       | Implemented; fake-provider, integration, and hosted PostgreSQL coverage passed in run #102.        |
| Browser-only authenticated admin/finance/parent/student workflow | MEDIUM       | Implemented; authenticated browser workflow passed in hosted run #102.                             |
| Missing `DATABASE_URL` runtime behavior                          | MEDIUM       | Implemented and focused-tested locally.                                                            |
| Deterministic seed/documentation/CI verifier coverage            | MEDIUM       | Implemented; migration, seed, reset, and verifier gates passed in hosted run #102.                 |
| Mock callback trust-boundary and replay safety                   | LOW / MEDIUM | Implemented; schema, service, verifier, unit, integration, and hosted coverage passed in run #102. |

## External Audit Repair Round 1 commands and actual results

| Command / check                             | Result                   | Notes                                                                                                                                                                  |
| ------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CodeGraph audit queries                     | Passed                   | Traced ledger mutations, receipt allocation, notification retry, callback, portal ownership, and CI blast radius before editing.                                       |
| `pnpm.cmd install --frozen-lockfile`        | Passed                   | Frozen lockfile install completed; a later local E2E attempt exposed a Windows pnpm link-recreation issue and required disposable dependency recovery.                 |
| Focused Prettier check                      | Passed                   | Changed source, test, migration metadata, workflow, README, and audit files were formatted; full repository formatting remains a Windows newline-baseline issue.       |
| `pnpm.cmd lint`                             | Passed                   | ESLint exited 0 after the Round 1 callback and migration-verifier changes.                                                                                             |
| `pnpm.cmd typecheck`                        | Passed                   | Strict TypeScript exited 0.                                                                                                                                            |
| `pnpm.cmd test`                             | Passed                   | 16 unit/component files and 49 tests passed, including receipt/net-payment, missing-database, and callback trust-boundary coverage.                                    |
| `pnpm.cmd test:integration`                 | Passed with local skips  | Three reset-safety tests passed; eight PostgreSQL workflow tests were skipped because `TEST_DATABASE_URL` is not configured locally.                                   |
| `pnpm.cmd build`                            | Passed                   | Next.js production build generated 51 routes; local output included expected Better Auth default-secret warnings because no secret is configured.                      |
| `pnpm.cmd format:check`                     | Baseline failure         | Prettier reported 131 existing repository files with Windows newline/style differences; the focused changed-file check passed.                                         |
| `pnpm.cmd test:e2e`                         | Not accepted locally     | The first run reused a stale local server; the clean-server attempt could not complete because the Windows pnpm web-server process recreated/removed dependency links. |
| Clean PostgreSQL migrations/seed/verifiers  | Passed in hosted CI #102 | Run #102 migrated, seeded, reset, and verified clean PostgreSQL databases before running the integration suite.                                                        |
| Authenticated browser-only Round 1 scenario | Passed in hosted CI #102 | Run #102 passed the visible admin, finance, parent, and student browser workflow plus existing smoke coverage.                                                         |

## External Audit Repair Round 2 implementation status

Round 2 is implemented on `fix/23-external-audit-round-2` pending independent hosted verification and regular merge. The repair adds migration `0003_ambiguous_puma.sql`, payable debit-adjustment targets with exactly-one-target enforcement, grouped multi-assessment payment/reversal ledger entries, semantic payment and mock-checkout idempotency conflicts, transactional administrator and guardian invariants, fee-structure serialization, persisted checkout expiry/channel state, auth infrastructure-error propagation, finance role-aware navigation, and persisted allocation detail on parent/student receipts.

CodeGraph was used before editing to trace payment, gateway, ledger, administration, guardian, fee-structure, portal, and navigation blast radius. The focused integration suite is `tests/integration/external-audit-round-2.test.ts`; it is skipped locally when `TEST_DATABASE_URL` is absent and is intended to be authoritative in hosted CI. No production, real-provider, accounting, security-certification, tax-receipt, or deployment claim is made.
