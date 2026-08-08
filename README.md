# Online School Fees Monitoring and Payment System

> **Capstone demonstration notice:** This is a single-school, fictional-data demonstration. It is not approved for real financial operations, tax receipting, institutional use, or production deployment.

## Current status

The repository currently contains a polished Next.js App Router UI, a committed Drizzle/PostgreSQL schema and migration contract, a connected Better Auth/RBAC workflow, persisted core administration, persisted student/guardian/fee administration, persisted assessment/ledger posting, and persisted CASH/BANK_DEPOSIT payment, receipt, and reversal transactions. Portal ownership, online-payment, reporting, notification, and deployment workflows remain intentionally staged for later phases.

The following items remain intentionally incomplete at this stage:

- Better Auth email/password sign-in, role-derived redirects, session logout, disabled-user rejection, protected layouts, and protected financial Route Handlers are implemented and verified against isolated PostgreSQL.
- Administrator-only institution settings, school-year activation, grade levels, sections, real user management, supported account creation, role changes, and account activation/deactivation are persisted through PostgreSQL and verified against isolated PostgreSQL.
- Student records, guardian records, parent/student account links, fee categories, and draft/active/archived fee structures are persisted through PostgreSQL and guarded for admin/finance access. Posted-assessment fee structures can only be archived.
- CASH and BANK_DEPOSIT payment posting, oldest-item allocation, idempotency, receipts, reversals, ledger entries, and audit events are persisted through PostgreSQL and verified by `pnpm payments-receipts:verify`.
- The committed Drizzle migration set creates a clean database and is verified against isolated PostgreSQL; portal ownership, online-payment, reporting, notification, and deployment workflows remain incomplete.
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
- Mock callback prototype: `/api/payments/mock-callback`
- Persisted receipt PDF route: `/api/receipts/[id]/pdf`
- CSV report prototype: `/api/reports/csv`
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

`DATABASE_URL` is required for database commands. `TEST_DATABASE_URL` must point to a separate PostgreSQL database and must never equal `DATABASE_URL`. Run `pnpm admin:verify`, `pnpm students-fees:verify`, `pnpm assessments-ledger:verify`, and `pnpm payments-receipts:verify` against an isolated seeded database to verify administration, student/guardian/fee, assessment/ledger, and OTC payment persistence and constraints.

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
- `pnpm db:seed` - seed fictional demo data
- `pnpm db:reset` - reset the demo database after explicit confirmation
- `pnpm db:test:reset` - reset only the separately configured test database

## Demo accounts

The fictional seed accounts are `admin@demo.school`, `finance@demo.school`, `parent@demo.school`, and `student@demo.school`; all use `DemoPass123!`. Public registration is disabled, and each account is routed by its stored role after sign-in.

## Architecture

The target server flow is:

`Route Handler or Server Action -> Zod validation -> Better Auth session -> server authorization -> service layer -> Drizzle transaction -> PostgreSQL`

See [docs/architecture.md](docs/architecture.md), [docs/assumptions.md](docs/assumptions.md), and the decision records in `docs/decisions/` for the current contract.
