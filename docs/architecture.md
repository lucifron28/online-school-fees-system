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

- The App Router pages and layouts are primarily visual prototype screens.
- Better Auth is configured with a Drizzle adapter, but the login pages are not yet connected to real sign-in and server layout protection.
- The database schema describes users, academic records, students, guardians, fees, assessments, ledger entries, payments, receipts, reversals, and audit logs.
- No committed migration set currently exists.
- Assessment, payment, portal, and report services include simulated or hardcoded results and must be replaced with PostgreSQL-backed implementations in later phases.
- The mock payment gateway is allowed by scope, but its checkout records, callback events, and idempotency state must become database-backed.

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
