# Online School Fees Monitoring and Payment System

> **Capstone demonstration notice:** This is a single-school, fictional-data demonstration. It is not approved for real financial operations, tax receipting, institutional use, or production deployment.

## Current status

The repository currently contains a polished Next.js App Router UI, a committed Drizzle/PostgreSQL schema and migration contract, a connected Better Auth/RBAC workflow, persisted core administration, persisted student/guardian/fee administration, persisted assessment/ledger posting, serialized CASH/BANK_DEPOSIT/MOCK_ONLINE ledger mutations, database-backed receipt sequences, reversal-aware parent/student accounts, database-backed reports and reconciliation, and persisted notification history with atomic retry claims. Round 2 adds payable debit adjustments, multi-assessment ledger attribution, semantic idempotency conflicts, checkout expiry, transactional administrator and guardian invariants, fee-structure serialization, auth infrastructure-error handling, role-aware finance navigation, and owner-portal receipt detail; its hosted evidence is verified by PR #14 and Foundation run [#111](https://github.com/lucifron28/online-school-fees-system/actions/runs/31304545247). Round 3 adds assessment-level credit limits, credit-aware allocation, immutable receipt issuance snapshots, lifecycle-inclusive debt reporting, non-active settlement rules, Manila-ranged statements, terminal checkout states, and historical-receipt UI coverage; its final-head hosted evidence is [#123](https://github.com/lucifron28/online-school-fees-system/actions/runs/31328129030), with historical run #122 retained. Final pre-deployment hardening adds complete multi-page statement/receipt PDFs, sanitized server error logs, bounded searchable OTC selection, and payment-origin processor snapshots. The seed is deterministic fictional data with 20 students, 10 guardians, persisted links, financial fixtures, mock checkout outcomes, notification history, and a withdrawn student with existing debt. External deployment remains pending configured fictional Vercel/Neon credentials.

The following scope statements remain important:

Final-head Round 3 evidence is hosted Foundation run [#123](https://github.com/lucifron28/online-school-fees-system/actions/runs/31328129030): migration/seed/reset/verifiers, formatting, lint, typecheck, 57 unit tests, 46 integration tests, build, and 7 Playwright tests passed. Historical run [#122](https://github.com/lucifron28/online-school-fees-system/actions/runs/31327646073) remains retained; this is not deployment or production-readiness evidence.

- Better Auth email/password sign-in, role-derived redirects, session logout, disabled-user rejection, protected layouts, and protected financial Route Handlers are implemented and verified against isolated PostgreSQL.
- Administrator-only institution settings, school-year activation, grade levels, sections, real user management, supported account creation, role changes, and account activation/deactivation are persisted through PostgreSQL and verified against isolated PostgreSQL.
- Student records, guardian records, parent/student account links, fee categories, and draft/active/archived fee structures are persisted through PostgreSQL and guarded for admin/finance access. Posted-assessment fee structures can only be archived.
- CASH and BANK_DEPOSIT payment posting, oldest-obligation allocation across assessment items and debit adjustments, per-assessment ledger grouping, semantic idempotency, receipts, reversals, ledger entries, and audit events are persisted through PostgreSQL and verified by `pnpm payments-receipts:verify`.
- The committed Drizzle migration set creates a clean database; hosted CI is the authoritative clean-PostgreSQL verification for the repair-round concurrency and browser suites.
- Parent and student portal queries are filtered from authenticated database relationships and expose persisted payment targets on receipt detail. Mock checkout and callback state is persisted with channel binding and enforced expiry; only a server-verified successful callback can create a `MOCK_ONLINE` payment through the shared payment service.
- The online payment flow is a mock demonstration only; it is not a GCash, Maya, card, banking, or payment-provider integration.
- No production-readiness, accounting, security-certification, or tax-receipt claim is made.

The completion checklist and verified evidence are tracked in [docs/goal-progress.md](docs/goal-progress.md) and [docs/goal-findings.md](docs/goal-findings.md).

## Scope and technical contract

- Single school per deployment
- Fictional data only
- Philippine peso values stored as integer centavos
- Asia/Manila timezone
- Next.js full-stack monolith deployed to Vercel for a fictional demo
- PostgreSQL hosted on Neon for the deployed demo
- Simulated online payments only
- Configurable student portal

The receipt label is **Payment Acknowledgment Receipt**. The application must not call it an official receipt.

## Existing application areas

- Admin and finance UI: `/admin/*`
- Parent UI: `/parent/*`
- Student UI: `/student/*`
- Login portals: `/login/admin`, `/login/parent`, `/login/student`
- Better Auth route handler: `/api/auth/*`
- Health check: `/api/health`
- Mock payment callback: `/api/payments/mock-callback`
- Parent portal APIs: `/api/portal/parent/children`, `/api/portal/parent/children/[id]`, `/api/portal/parent/payments`, and `/api/portal/parent/checkouts`
- Student portal APIs: `/api/portal/student/account` and `/api/portal/student/payments`
- Persisted receipt PDF route: `/api/receipts/[id]/pdf`
- Owned portal receipt PDF route: `/api/portal/receipts/[id]/pdf`
- Reports API: `/api/reports/summary`, `/api/reports/collections`, `/api/reports/outstanding`, `/api/reports/reversals`, and `/api/reports/statement/[studentId]`
- Report exports: `/api/reports/csv` and `/api/reports/statements/[studentId]/pdf`
- Notifications: `/api/notifications`, `/api/notifications/[id]/retry`, and role-scoped notification pages under `/admin/notifications`, `/parent/notifications`, and `/student/notifications`
- Administrator APIs: `/api/admin/settings`, `/api/admin/school-years`, `/api/admin/grade-levels`, `/api/admin/sections`, `/api/admin/users`
- Student/guardian APIs: `/api/admin/students`, `/api/admin/guardians`, and guardian-link subroutes
- Fee APIs: `/api/admin/fee-options`, `/api/admin/fee-categories`, and `/api/admin/fee-structures`
- Assessment and ledger APIs: `/api/admin/students/[id]/assessments`, `/api/admin/assessments/[id]`, and `/api/admin/assessments/[id]/adjustments`
- Payment and receipt APIs: `/api/admin/payments`, `/api/admin/payments/[id]`, `/api/admin/payments/[id]/reverse`, and `/api/receipts/[id]/pdf`

## Local setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`DATABASE_URL` is required for database commands. `TEST_DATABASE_URL` must point to a separate PostgreSQL database and must never equal `DATABASE_URL`. Run the phase verifiers, including `pnpm notifications:verify`, against an isolated seeded database to verify PostgreSQL persistence, ownership, financial transactions, notification delivery, and constraints.

For an intentionally destructive demo reset, set the confirmation first:

```powershell
$env:DEMO_DB_RESET_CONFIRMATION = 'RESET_DEMO'
pnpm db:reset
```

For an intentionally destructive test reset:

```powershell
$env:TEST_DB_RESET_CONFIRMATION = 'RESET_TEST_DATABASE'
pnpm db:test:reset
```

The reset commands refuse production mode, missing confirmations, and unsafe database-target combinations. Run `pnpm db:verify:migrations` after `pnpm db:migrate` to verify the committed contract on a configured test database. Localhost PostgreSQL URLs use the node-postgres adapter; remote demo URLs continue to use Neon.

## Available scripts

- `pnpm dev` - start the development server
- `pnpm build` - build the production bundle
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run the strict TypeScript check
- `pnpm format:check` - verify Prettier formatting
- `pnpm test` - run unit and component tests
- `pnpm test:integration` - run database/tooling integration tests
- `pnpm test:e2e` - run Playwright browser tests
- `pnpm db:generate` - generate Drizzle migrations
- `pnpm db:migrate` - apply committed Drizzle migrations
- `pnpm db:verify:migrations` - verify tables, constraints, enums, timestamps, and financial delete protection
- `pnpm auth:verify` - verify Better Auth demo sign-in, sessions, logout, disabled users, and public sign-up rejection
- `pnpm admin:verify` - verify persisted settings, school years, academic structure, account roles, and disabled-account enforcement
- `pnpm students-fees:verify` - verify persisted student/guardian/fee records, account links, duplicate rejection, and posted-assessment structure locking
- `pnpm assessments-ledger:verify` - verify authoritative assessment snapshots, transactional ledger posting, duplicate prevention, adjustments, audit records, and rollback
- `pnpm payments-receipts:verify` - verify OTC payment allocation, overpayment rejection, idempotency, receipts, reversals, ledger restoration, audit events, and cleanup
- `pnpm portals-online:verify` - verify parent/student ownership, persisted mock checkout/callback state, server-authorized success, duplicate callbacks, restart-safe verification, and cleanup
- `pnpm reports-reconciliation:verify` - verify database-backed dashboard metrics, Manila date ranges, net/reversal totals, outstanding balances, statements, breakdowns, formula-safe CSV, statement PDF output, and cleanup
- `pnpm notifications:verify` - verify persisted assessment/payment/receipt/reversal notifications, console fallback, provider failures and retries, financial success despite email failure, duplicate payment protection, duplicate callback protection, and cleanup
- `pnpm db:seed` - seed fictional demo data
- `pnpm db:reset` - reset the demo database after explicit confirmation
- `pnpm db:test:reset` - reset only the separately configured test database

## Demo accounts

The fictional seed accounts are `admin@demo.school`, `finance@demo.school`, `parent@demo.school`, and `student@demo.school`; all use `DemoPass123!`. Public registration is disabled, and each account is routed by its stored role after sign-in. The seed also creates 20 demo students, 10 guardians, guardian/student links, and linked student/parent walkthrough data.

## Architecture

The target server flow is:

`Route Handler or Server Action -> Zod validation -> Better Auth session -> server authorization -> service layer -> Drizzle transaction -> PostgreSQL`

See [docs/architecture.md](docs/architecture.md), [docs/assumptions.md](docs/assumptions.md), and the decision records in `docs/decisions/` for the current contract.
