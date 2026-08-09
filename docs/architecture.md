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

- The current student, guardian, fee, financial, portal, report, and notification workflows load persisted records; the portal layouts require authenticated stored roles.
- Better Auth uses a Drizzle adapter with public sign-up disabled, server-only role/active fields, disabled-user rejection, and a reusable TanStack Form login flow. Admin/finance report and receipt Route Handlers require server-side authorization.
- Core administration uses `src/server/services/administration.service.ts` behind administrator-only Route Handlers. Institution settings use a singleton key, school-year activation is transactional, and grade levels, sections, and user accounts are loaded from PostgreSQL rather than fixed page state.
- The database schema describes users, academic records, students, guardians, fees, assessment periods, assessments, ledger entries, payments, receipts, receipt sequences, reversals, audit logs, persisted mock checkouts/callbacks, notification delivery, and notification attempt history.
- `src/db/migrations/0000_good_ghost_rider.sql` and the committed follow-up migrations are the database contract; hosted CI applies them to clean PostgreSQL databases.
- Financial event timestamps use PostgreSQL `timestamp with time zone`; monetary values use integer centavos with database checks.
- Localhost PostgreSQL URLs use node-postgres for seed/reset/integration tooling, while remote deployment URLs continue to use Neon.
- Assessment generation, ledger balance calculation, OTC payment posting, portal ownership, mock online-payment completion, report aggregation, and notification history are PostgreSQL-backed. External deployment remains a later environment-dependent gate.
- The mock payment gateway is allowed by scope. Its checkout records, callback events, and idempotency state are persisted, while no real payment-provider integration is claimed.

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
- every assessment posting and adjustment acquires the shared student row lock before reading or writing ledger state, matching the payment and reversal lock order;
- every adjustment requires a reason and records the approving user and an audit event.

## Payment, receipt, and reversal boundary

`src/server/services/payment.service.ts` owns CASH and BANK_DEPOSIT posting, oldest-obligation allocation, receipt creation, payment listing/detail queries, receipt PDF data, and compensating reversals. Payment Route Handlers accept only `ADMIN` and `FINANCE_STAFF` sessions; all financial values and identifiers are derived server-side.

The Phase 6 service enforces the following invariants:

- the current student balance comes from persisted ledger entries, and overpayments are rejected;
- payments allocate oldest-first across database-derived posted assessment items and positive `DEBIT` adjustments using prior posted allocations; `CREDIT` adjustments never become targets and each allocation satisfies an exactly-one-target database check;
- payment, allocations, one ledger entry per represented assessment, receipt, and audit events are written in one transaction; the nullable payment assessment field is a convenience value only when one assessment is represented;
- receipt numbers are allocated inside the payment transaction from the persisted school prefix, Asia/Manila calendar year, and a database-backed prefix/year sequence; the required idempotency key prevents replayed and concurrent duplicate submissions and rejects mismatched student, amount, method, or normalized reference semantics with a conflict;
- a reversal preserves the original payment, voids its receipt, adds a compensating debit, and records the reason and actor; a second reversal is rejected;
- receipt PDFs are generated from persisted receipt, payment, allocation, student, institution, and status data rather than browser-supplied or random financial values;
- parent-facing net payments are calculated as `PAYMENT` credits less `REVERSAL` debits, while reversal history remains separately visible.

## Parent/student portal and mock online-payment boundary

`src/server/services/portal.service.ts` owns portal queries and derives access from the authenticated user's persisted relationship: a parent reaches students through `guardians.userId -> guardianStudents -> students`, while a student reaches only the `students.userId` row. Portal Route Handlers never accept caller-supplied child lists or student ownership claims.

`src/server/services/payment-gateway.service.ts` owns the mock checkout and callback boundary. Checkout rows and callback events are persisted in PostgreSQL, with unique idempotency keys, callback event identifiers, payment-channel binding, and an expiry state. The stored checkout is authoritative for the student, assessment binding, amount, and channel; browser return URLs and callback bodies cannot mark a payment successful or change its financial values.

The Phase 7 invariants are:

- parent and student list/detail/payment/receipt queries are filtered by authenticated database ownership;
- checkout creation is idempotent and rejects amounts above the student's persisted ledger balance; replay conflicts are checked against student, assessment, amount, and channel;
- `PENDING`, `FAILED`, and `CANCELLED` callbacks do not create payments, allocations, receipts, or ledger entries;
- a verified `SUCCESS` callback calls the shared `PaymentService` with `MOCK_ONLINE`, then records the checkout payment ID;
- duplicate callback events and repeated checkout idempotency keys return the existing persisted result without duplicate financial records;
- callback input cannot choose the student, amount, payment method, or checkout ownership; unknown references fail, replay keys cannot cross checkout references, expired `CREATED` checkouts cannot create payments, and terminal checkout states cannot be reopened;
- a new gateway instance can verify the same checkout because state is not held in a module-level map.

## Reports and reconciliation boundary

`src/server/services/report.service.ts` owns dashboard metrics, date-range collection/payment-history reports, outstanding balances, reversals, payment-method and grade-level breakdowns, student statements, CSV serialization, and reconciliation flags. Every report Route Handler requires `ADMIN` or `FINANCE_STAFF`; parent and student users cannot access administrative report data.

The Phase 8 invariants are:

- date filters are converted from Asia/Manila calendar dates to UTC instants before PostgreSQL comparison;
- net collections include only `POSTED` payments, while `REVERSED` payments remain visible in the reversal and transaction reports;
- dashboard totals, screen tables, and CSV exports use the same service results, so exported totals cannot diverge from displayed totals;
- CSV cells beginning with spreadsheet formula characters are prefixed with a text marker to prevent formula injection;
- reconciliation is `RECONCILED` only when the persisted receipt and allocation total agree with the payment; missing or mismatched records are marked `REVIEW`;
- student statements and statement PDFs are generated from persisted ledger entries and student data, with the demo disclaimer preserved.

## Notification delivery boundary

`src/server/services/notification.service.ts` owns notification recipient resolution, persisted event dedupe, delivery attempts, provider selection, failure recording, and manual retries. Assessment posting, payment success, receipt availability, and reversal dispatches are invoked after their financial transaction commits; provider failures are caught and recorded without changing the financial result.

The Phase 9 invariants are:

- recipients are resolved from the persisted student-user and guardian-user relationships; caller-supplied recipient lists are not accepted;
- notification dedupe keys include the persisted event entity and recipient user, while the delivery table enforces one channel row per notification;
- Resend is selected only when its API key and sender address are configured; otherwise the console provider records a deterministic local/CI-safe delivery outcome;
- delivery attempts record channel, status, attempt count, provider message ID, timestamps, and failure text, with an atomic database claim, persisted attempt history, and an authenticated admin/finance manual retry route; `SENT` is terminal and no scheduler claim is assumed in this scope;
- duplicate payment idempotency requests and duplicate mock callback events do not create or deliver duplicate notification records;
- no due reminder is emitted until due-date requirements are confirmed.
