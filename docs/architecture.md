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

- The App Router pages still contain visual prototype data in later financial screens, but the portal layouts now require authenticated stored roles.
- Better Auth uses a Drizzle adapter with public sign-up disabled, server-only role/active fields, disabled-user rejection, and a reusable TanStack Form login flow. Admin/finance report and receipt Route Handlers require server-side authorization.
- Core administration uses `src/server/services/administration.service.ts` behind administrator-only Route Handlers. Institution settings use a singleton key, school-year activation is transactional, and grade levels, sections, and user accounts are loaded from PostgreSQL rather than fixed page state.
- The database schema describes users, academic records, students, guardians, fees, assessment periods, assessments, ledger entries, payments, receipts, reversals, audit logs, persisted mock checkouts/callbacks, and notification delivery.
- `src/db/migrations/0000_good_ghost_rider.sql` is the committed initial migration and has been verified on a blank isolated PostgreSQL database.
- Financial event timestamps use PostgreSQL `timestamp with time zone`; monetary values use integer centavos with database checks.
- Localhost PostgreSQL URLs use node-postgres for seed/reset/integration tooling, while remote deployment URLs continue to use Neon.
- Assessment, payment, portal, and report services include simulated or hardcoded results and must be replaced with PostgreSQL-backed implementations in later phases.
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
