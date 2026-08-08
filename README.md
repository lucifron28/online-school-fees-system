# Online School Fees Monitoring and Payment System

> **Capstone demonstration notice:** This is a single-school, fictional-data demonstration. It is not approved for real financial operations, tax receipting, institutional use, or production deployment.

## Current status

The repository currently contains a polished Next.js App Router UI, a committed Drizzle/PostgreSQL schema and migration contract, Better Auth configuration, server-side business-rule prototypes, and unit tests. The visual screens are not evidence of a complete connected workflow yet.

The following items remain intentionally incomplete at this stage:

- Login pages currently demonstrate the portal UI and redirect without completing Better Auth sign-in.
- Assessment, payment, reversal, portal, and report services still contain simulated or hardcoded results.
- The Phase 1 Drizzle migration set creates a clean database and is verified against isolated PostgreSQL; later authenticated and persisted workflows remain incomplete.
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
- Login prototypes: `/login/admin`, `/login/parent`, `/login/student`
- Better Auth route handler: `/api/auth/*`
- Health check: `/api/health`
- Mock callback prototype: `/api/payments/mock-callback`
- Receipt PDF prototype: `/api/receipts/[id]/pdf`
- CSV report prototype: `/api/reports/csv`

## Local setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`DATABASE_URL` is required for database commands. `TEST_DATABASE_URL` must point to a separate PostgreSQL database and must never equal `DATABASE_URL`.

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
- `pnpm db:seed` - seed fictional demo data
- `pnpm db:reset` - reset the demo database after explicit confirmation
- `pnpm db:test:reset` - reset only the separately configured test database

## Demo accounts

The intended fictional seed accounts are `admin@demo.school`, `finance@demo.school`, `parent@demo.school`, and `student@demo.school`. Until the authentication phase is complete, these values are seed targets and not a claim that the current login screens authenticate successfully.

## Architecture

The target server flow is:

`Route Handler or Server Action -> Zod validation -> Better Auth session -> server authorization -> service layer -> Drizzle transaction -> PostgreSQL`

See [docs/architecture.md](docs/architecture.md), [docs/assumptions.md](docs/assumptions.md), and the decision records in `docs/decisions/` for the current contract.
