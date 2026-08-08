# Architecture Overview

## Current repository shape

This is a single Next.js App Router monolith written in strict TypeScript.

```text
src/
├── app/                 # pages, layouts, and Route Handlers
├── components/          # shared layout and UI primitives
├── db/                  # Drizzle schema, client, and scripts
├── lib/                 # auth, env, query, PDF, and utility modules
├── server/              # server-only guards, errors, and domain services
└── types/               # shared TypeScript types
```

The repository does not currently contain the `features/` or `components/shared/` directories described by an older architecture draft. That draft has been corrected rather than treated as implementation evidence.

## Target request flow

Every state-changing request must follow this boundary:

`Route Handler or Server Action`
→ `Zod validation`
→ `Better Auth session lookup`
→ `server-side role and ownership authorization`
→ `domain service`
→ `Drizzle query or transaction`
→ `typed result`

Client Components must not import server-only services. Financial rules must remain in services, never in React components. Browser-supplied balances, roles, ownership lists, receipt numbers, statuses, and processor IDs are untrusted.

## Current implementation boundary

- The App Router pages still contain visual prototype data in later financial screens, but the student, guardian, and fee-management screens now load persisted records and the portal layouts require authenticated stored roles.
- Better Auth uses a Drizzle adapter with public sign-up disabled, server-only role/active fields, disabled-user rejection, and a reusable TanStack Form login flow. Admin/finance report and receipt Route Handlers require server-side authorization.
- Core administration uses `src/server/services/administration.service.ts` behind administrator-only Route Handlers. Institution settings use a singleton key, school-year activation is transactional, and grade levels, sections, and user accounts are loaded from PostgreSQL rather than fixed page state.
- The database schema describes users, academic records, students, guardians, fees, assessment periods, assessments, ledger entries, payments, receipts, reversals, audit logs, persisted mock checkouts/callbacks, and notification delivery.
- `src/db/migrations/0000_good_ghost_rider.sql` is the committed initial migration and has been verified on a blank isolated PostgreSQL database.
- Financial event timestamps use PostgreSQL `timestamp with time zone`; monetary values use integer centavos with database checks.
- Localhost PostgreSQL URLs use node-postgres for seed/reset/integration tooling, while remote deployment URLs continue to use Neon.
- Assessment generation, ledger balance calculation, and OTC payment posting are PostgreSQL-backed and transactional. Portal ownership, mock online-payment persistence, and report aggregation remain later vertical slices.
- The mock payment gateway is allowed by scope; its checkout records, callback events, and idempotency state now have database tables, while the gateway behavior remains a later vertical-slice implementation.

## State ownership

- Authentication and sessions: Better Auth
- Persistent data: PostgreSQL
- Database access: Drizzle ORM
- Initial server-readable data: Server Components
- Interactive server state: TanStack Query
- Form state: TanStack Form v1
- Validation: Zod
- Complex tables: TanStack Table
- Shareable filters, sorting, and pagination: URL search parameters
- Small temporary UI state: React local state

## Core administration boundary

The `/admin/settings` and `/admin/users` pages perform an exact `ADMIN` role check in addition to the broader admin layout guard. Their client components use TanStack Query only for request state; validation, role policy, school-year constraints, and account creation remain server-side.

The administration service owns the following invariants:

- one singleton institution-settings row;
- one active school year, with valid start/end dates;
- sections reference existing grade levels and non-archived school years;
- user role and active status changes preserve at least one active administrator and cannot disable or demote the acting administrator;
- new accounts are created through the supported Better Auth server flow, not by accepting browser-controlled role fields.

## Student, guardian, and fee-management boundary

`src/server/services/students-fees.service.ts` owns student lifecycle, guardian links, fee categories, fee structures, and fee items. The corresponding `/api/admin/*` Route Handlers accept only `ADMIN` and `FINANCE_STAFF` sessions; parent and student portal users cannot enumerate or mutate these records.

The Phase 4 service enforces the following invariants:

- student numbers, guardian/student links, and account links are unique;
- student section assignments match their selected grade level and school year;
- linked student accounts have role `STUDENT`, and linked guardian accounts have role `PARENT`;
- active fee structures reference active school years and active fee categories;
- a fee structure with a `POSTED` student assessment cannot have its definition or items changed and can only be archived;
- all client forms use shared Zod schemas, while authorization and mutation rules remain server-side.

## Assessment and ledger boundary

`src/server/services/assessment.service.ts` owns assessment generation, fee-item snapshots, ledger balance calculation, and authorized adjustments. Assessment and adjustment Route Handlers accept only `ADMIN` and `FINANCE_STAFF` sessions; the student profile displays persisted results through TanStack Query.

The Phase 5 service enforces the following invariants:

- only active students, active school years, and active fee structures can produce a posted assessment;
- fee items and amounts are loaded from PostgreSQL and copied into `assessment_items`; browser-supplied item values are never trusted;
- the database uniqueness rule prevents two assessments for one student, school year, and period;
- assessment, snapshot items, the assessment ledger entry, and the audit event are written in one transaction;
- balances are recalculated from persisted debit/credit entries, and credit adjustments cannot make a balance negative;
- every adjustment requires a reason and records the approving user and an audit event.

## Payment, receipt, and reversal boundary

`src/server/services/payment.service.ts` owns CASH and BANK_DEPOSIT posting, allocation, receipt creation, payment listing/detail queries, receipt PDF data, and compensating reversals. Payment Route Handlers accept only `ADMIN` and `FINANCE_STAFF` sessions; all financial values and identifiers are derived server-side.

The Phase 6 service enforces the following invariants:

- the current student balance comes from persisted ledger entries, and overpayments are rejected;
- payments allocate to the oldest outstanding posted-assessment items using database-derived item amounts and prior posted allocations;
- payment, allocations, the payment ledger entry, receipt, and audit events are written in one transaction;
- the database-generated payment UUID is used to derive receipt and verification identifiers; the required idempotency key prevents replayed and concurrent duplicate submissions;
- a reversal preserves the original payment, voids its receipt, adds a compensating debit, and records the reason and actor; a second reversal is rejected;
- receipt PDFs are generated from persisted receipt, payment, allocation, student, institution, and status data rather than browser-supplied or random financial values.
