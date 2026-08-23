# Code Review Remediation Log

This document records the completed code-review remediation and hardening pass for the Online School Fees Monitoring and Payment System across all findings identified in the repository-wide external audit.

## Summary of Remediations

| Item | Area                                                                            | Severity | Status   |
| ---- | ------------------------------------------------------------------------------- | -------- | -------- |
| 1    | Production Database Adapter / Neon Transactions                                 | Blocker  | Resolved |
| 2    | Payment-Proof Reviewer Provenance & Lifecycle Constraints                       | Blocker  | Resolved |
| 3    | Exact Monetary Parsing (No Floating Point)                                      | High     | Resolved |
| 4    | Notification Delivery Crash-Recoverable Lease & Retry Scheduler                 | High     | Resolved |
| 5    | Demo Navigation Opt-In Default                                                  | High     | Resolved |
| 6    | Payment-Proof Request & Body Size Protection                                    | Medium   | Resolved |
| 7    | SQL-Filtered Bounded Deadlines & Due Reminders                                  | Medium   | Resolved |
| 8    | Server-Backed Pagination for Complete Reports                                   | Medium   | Resolved |
| 9    | Paginated Admin Announcements & Filters                                         | Medium   | Resolved |
| 10   | Financial Redundant Database Lineage Integrity                                  | Medium   | Resolved |
| 11   | TypeScript Safety Hardening (`noImplicitReturns`, `noFallthroughCasesInSwitch`) | Medium   | Resolved |
| 12   | ESLint Async/Promise Safety Rules                                               | Medium   | Resolved |
| 13   | Application-Level Security Headers                                              | Medium   | Resolved |
| 14   | Parent Portal Set-Based Child Query (N+1 Removed)                               | Low      | Resolved |
| 15   | Oversized Module Refactoring (Payment Allocation)                               | Low      | Resolved |
| 16   | Payment-Proof Upload Keyboard Focus Indication                                  | Low      | Resolved |
| 17   | Accessible Password Show/Hide Control on Login Forms                            | Low      | Resolved |
| 18   | Documentation Drift Cleanup                                                     | Low      | Resolved |

---

## Detailed Remediation Items

### 1. Blocker: Production Database Adapter / Neon Transaction Support

- **Issue**: The database initialization chose Neon HTTP adapter for remote database URLs, which lacked support for interactive transactions (`db.transaction(async (tx) => ...)`), `SELECT ... FOR UPDATE` row locks, and transactional orchestration relied upon by payment posting and proof approval. CI used local `node-postgres`, creating driver disparity.
- **Affected files**:
  - `src/db/index.ts`
  - `src/server/services/payment.service.ts`
  - `src/server/services/assessment.service.ts`
  - `src/server/services/students-fees.service.ts`
  - `src/server/services/payment-submission.service.ts`
  - `src/server/services/ledger.service.ts`
  - `src/server/services/receipt.service.ts`
  - `src/server/services/administration.service.ts`
- **Chosen solution**:
  - Standardized runtime database client on Drizzle's transaction-capable `node-postgres` adapter with pooled `pg.Pool`.
  - Unified DB types with `DatabaseInstance`, `TransactionInstance`, and `DatabaseClient`.
  - Removed all `as unknown as DatabaseInstance` unsafe coercions across the services layer.
- Enabled SSL compatibility with Neon pooled connection strings (`postgres://...-pooler.neon.tech`) using verified TLS (`ssl: true` without `rejectUnauthorized: false`).
- **Tests added/changed**:
  - `tests/unit/db-runtime.test.ts`: verified production-style Neon pooled URL constructs a transaction-capable client with `transaction`, `select`, `insert`, `update`, `delete`.
  - `tests/integration/code-review-remediation.test.ts`: verified interactive transaction callbacks and row-locking payment flows.
- **Verification result**: Verified. `pnpm test`, `pnpm db:verify:migrations`, and all 11 DB verifiers pass.

---

### 2. Blocker: Restore Payment-Proof Reviewer Provenance

- **Issue**: Migration 0008 previously included a current-role check (`reviewer.role IN ('ADMIN', 'FINANCE_STAFF')`) that could erase legitimate historical reviewer attribution if a staff member's role changed or account deactivated later.
- **Affected files**:
  - `src/db/schema/index.ts`
  - `src/db/migrations/0008_normal_shotgun.sql`
  - `src/db/migrations/0009_talented_james_howlett.sql`
  - `src/server/services/payment-submission.service.ts`
  - `src/db/scripts/verify-payment-submissions.ts`
  - `src/db/scripts/verify-migrations.ts`
  - `tests/integration/payment-submissions.test.ts`
  - `tests/integration/code-review-remediation.test.ts`
- **Chosen solution**:
  - Corrected `0008_normal_shotgun.sql` to remove the destructive current-role check, preserving genuine historical reviewer attribution.
  - Added `legacy_reviewer_unknown boolean NOT NULL DEFAULT false` column to `payment_submissions` in `0009_talented_james_howlett.sql`.
  - Hardened `payment_submissions_lifecycle_consistent` PostgreSQL CHECK constraint:
    - Normal `APPROVED` requires `reviewedByUserId NOT NULL`, `reviewedAt NOT NULL`, `approvedPaymentId NOT NULL`, `rejectionReason NULL`.
    - Normal `REJECTED` requires `reviewedByUserId NOT NULL`, `reviewedAt NOT NULL`, `rejectionReason NOT NULL`, `approvedPaymentId NULL`.
    - `PENDING_VERIFICATION` requires `reviewedByUserId NULL`, `reviewedAt NULL`, `rejectionReason NULL`, `approvedPaymentId NULL`, `legacyReviewerUnknown = false`.
    - `legacyReviewerUnknown = true` is strictly permitted only on legacy historical records that genuinely lack recoverable reviewer data.
  - Updated rejection integration tests to assert that PostgreSQL rejects attempts to clear reviewer metadata from normal rejected submissions.
- **Tests added/changed**:
  - `tests/integration/code-review-remediation.test.ts`: verified reviewer role changes/deactivation do not erase historical attribution, and unverified terminal rows with `legacyReviewerUnknown = false` are rejected.
  - `tests/integration/payment-submissions.test.ts`: verified that clearing reviewer attribution on a rejected submission violates the database check constraint.
  - `src/db/scripts/verify-migrations.ts`: verified CHECK constraint enforces reviewer presence on normal approved submissions.
- **Verification result**: Verified. `pnpm db:verify:migrations` and `pnpm payment-submissions:verify` pass.

---

### 3. High: Remove Floating-Point Money Parsing

- **Issue**: Currency parsing used `parseFloat` and `Math.round(val * 100)`, introducing potential binary floating-point precision risks.
- **Affected files**:
  - `src/lib/utils/currency.ts`
  - `tests/unit/currency-parsing.test.ts`
- **Chosen solution**:
  - Implemented exact string-based integer centavo parser (`parsePesoStringToCentavos`) using integer arithmetic without floating multiplication.
  - Validated whole and decimal digit strings (0 to 2 decimal places), padded fractions (`"10.5"` -> `"10.50"` -> `1050`), and rejected invalid inputs, negative numbers, three-decimal inputs, scientific notation, and values exceeding PostgreSQL 32-bit signed integer range.
- **Tests added/changed**:
  - `tests/unit/currency-parsing.test.ts`: 14 test cases covering zero, single centavos, whole pesos, 1 decimal digit, 2 decimal digits, commas, currency symbols, whitespace, excessive decimals rejection, negative rejection, malformed string rejection, and 32-bit boundary checks.
- **Verification result**: Verified. All 14 test cases pass in `pnpm test`.

---

### 4. High: Crash-Recoverable Notification Deliveries & Scheduled Retries

- **Issue**: A worker or server crash during delivery attempt could leave a notification delivery stuck in `RETRYING` indefinitely.
- **Affected files**:
  - `src/db/schema/index.ts`
  - `src/db/migrations/0009_talented_james_howlett.sql`
  - `src/server/services/notification.service.ts`
  - `src/server/services/reminder.service.ts`
  - `tests/unit/notifications.test.ts`
  - `tests/integration/code-review-remediation.test.ts`
- **Chosen solution**:
  - Added `claimed_at` and `lease_expires_at` timestamp columns with index to `notification_deliveries`.
  - Configured 5-minute crash-recovery lease (`DELIVERY_LEASE_MS = 300000`).
  - Allowed stale `RETRYING` deliveries with expired leases to be atomically claimed and re-attempted.
  - Added `NotificationService.processDueNotificationRetries()` and wired it into `ReminderService.runScheduledProcessing()` to automatically process due retries and recover stale leases.
- **Tests added/changed**:
  - `tests/unit/notifications.test.ts`: verified attempt limits and lease durations.
  - `tests/integration/code-review-remediation.test.ts`: verified expired lease reclamation to SENT and non-stealing of active leases.
  - `src/db/scripts/verify-notifications.ts`: verified max attempts exhaustion and idempotent retry.
- **Verification result**: Verified. `pnpm test` and `pnpm notifications:verify` pass.

---

### 5. High: Demo Navigation Opt-In Default

- **Issue**: `NEXT_PUBLIC_ENABLE_DEMO_NAV` defaulted to enabled (`true`), exposing demo navigation bars by default.
- **Affected files**:
  - `src/lib/env/index.ts`
  - `.env.example`
  - `tests/unit/env.test.ts`
- **Chosen solution**:
  - Updated `clientEnvSchema` so `NEXT_PUBLIC_ENABLE_DEMO_NAV` defaults to `false` and only evaluates to `true` when explicitly configured as `'true'`.
  - Updated `.env.example` to default to `false`.
- **Tests added/changed**:
  - `tests/unit/env.test.ts`: unit tests proving undefined -> false, false -> false, arbitrary string -> false, true -> true.
- **Verification result**: Verified. All unit tests pass in `pnpm test`.

---

### 6. Medium: Harden Payment-Proof Request Size Limits

- **Issue**: Unbounded multipart request parsing could occur before application-level image checks, and requests lacking Content-Length could bypass request size bounds.
- **Affected files**:
  - `src/server/services/payment-submission.service.ts`
  - `src/app/api/portal/parent/payment-submissions/route.ts`
  - `tests/unit/payment-proof.test.ts`
- **Chosen solution**:
  - Hardened `assertPaymentProofRequestSize` to reject requests with declared Content-Length exceeding `MAX_PAYMENT_PROOF_REQUEST_BYTES` (3.25 MiB) or invalid values.
  - Implemented `readBoundedMultipartRequest` and `createBoundedStream` to stream-limit incoming request bodies and abort immediately if streamed bytes exceed `MAX_PAYMENT_PROOF_REQUEST_BYTES`, even when Content-Length is omitted or chunked.
  - Maintained image size validation (1 byte to 3 MiB) and magic bytes verification (JPEG, PNG, WebP).
- **Tests added/changed**:
  - `tests/unit/payment-proof.test.ts`: tested valid PNG/JPEG/WebP proofs, wrong MIME types, MIME/magic signature mismatches, corrupted bytes, oversized buffers (>3 MiB), Content-Length header validations, and streaming size limits without Content-Length.
- **Verification result**: Verified. All 11 tests pass in `pnpm test`.

---

### 7. Medium: Move Deadline Filtering Toward SQL & Bounded Batching

- **Issue**: Deadline processing loaded broad historical assessment sets into memory before JS-level filtering, and reminder processing processed all candidates in an unbounded sequential pass.
- **Affected files**:
  - `src/server/services/deadline.service.ts`
  - `src/server/services/reminder.service.ts`
- **Chosen solution**:
  - Refactored `listAssessmentDeadlineMonitor` to compute ledger balance totals via SQL subquery join.
  - Filtered at the database level: `status = 'POSTED'`, `dueDate <= today + reminderLeadDays`, and `balanceCentavos > 0`.
  - Applied deterministic ordering (`due_date ASC, id ASC`) and supported SQL `limit` and `offset`.
  - Implemented bounded batch processing in `ReminderService.runDueReminders` (batch size 50, offset iteration) to process large datasets without memory exhaustion.
- **Tests added/changed**:
  - `tests/integration/code-review-remediation.test.ts`: verified SQL-bounded monitoring filters settled obligations and distant dates.
- **Verification result**: Verified. `pnpm deadlines-announcements:verify` passes.

---

### 8. Medium: Fix Silent Report Truncation & Add Pagination

- **Issue**: Outstanding and reversal reports used slice-like truncation without clear pagination indication.
- **Affected files**:
  - `src/lib/reports.ts`
  - `src/server/services/report.service.ts`
  - `src/app/api/reports/collections/route.ts`
  - `src/app/api/reports/outstanding/route.ts`
  - `src/app/api/reports/reversals/route.ts`
  - `src/app/admin/reports/page.tsx`
  - `tests/unit/reports.test.ts`
- **Chosen solution**:
  - Added `reportPaginationSchema` with Zod validation.
  - Ensured `getOutstandingBalanceReportPage` and `getReversalReportPage` compute whole-dataset summary totals while paginating table items.
  - Connected `PaginationControls` in `AdminReportsPage` for collection, outstanding, and reversal tables.
- **Tests added/changed**:
  - `tests/unit/reports.test.ts`: verified pagination schema validation, default parameters, and boundary limits.
- **Verification result**: Verified. `pnpm reports-reconciliation:verify` and `pnpm test` pass.

---

### 9. Medium: Paginate Admin Announcements

- **Issue**: Admin announcement history loaded an unbounded archive without pagination or filtering.
- **Affected files**:
  - `src/lib/announcements.ts`
  - `src/server/services/announcement.service.ts`
  - `src/app/api/admin/announcements/route.ts`
  - `src/components/announcements/announcement-list.tsx`
  - `tests/unit/announcements.test.ts`
- **Chosen solution**:
  - Added `announcementListInputSchema` and `AnnouncementListPage` types.
  - Refactored `listAnnouncements` to support `page`, `pageSize` (default 20, max 100), `status`, `audience`, and `search` filters with SQL count and offset pagination.
  - Added search input, status filter, audience filter, and `PaginationControls` to the admin announcement archive UI.
- **Tests added/changed**:
  - `tests/unit/announcements.test.ts`: verified query validation, creation constraints, and partial updates.
- **Verification result**: Verified. `pnpm deadlines-announcements:verify` and `pnpm test` pass.

---

### 10. Medium: Strengthen Financial Database Lineage

- **Issue**: Tables storing redundant relationships (`student_id` and `assessment_id`) did not verify composite foreign key integrity at the database level.
- **Affected files**:
  - `src/db/schema/index.ts`
  - `src/db/migrations/0009_talented_james_howlett.sql`
  - `src/db/scripts/verify-migrations.ts`
  - `tests/integration/code-review-remediation.test.ts`
- **Chosen solution**:
  - Added composite unique constraint `student_assessments_id_student_id_unique` on `student_assessments(id, student_id)`.
  - Added composite foreign keys:
    - `adjustments(assessment_id, student_id) REFERENCES student_assessments(id, student_id)`
    - `ledger_entries(assessment_id, student_id) REFERENCES student_assessments(id, student_id)`
    - `payments(assessment_id, student_id) REFERENCES student_assessments(id, student_id)`
- **Tests added/changed**:
  - `src/db/scripts/verify-migrations.ts` and `tests/integration/code-review-remediation.test.ts`: verified that PostgreSQL rejects adjustments and ledger entries with mismatched `student_id` and `assessment_id`.
- **Verification result**: Verified. `pnpm db:verify:migrations` passes.

---

### 11. Medium: TypeScript Safety Hardening

- **Issue**: Potential compiler blind spots with non-strict switch fallthrough, implicit returns, and unchecked array indexing.
- **Affected files**:
  - `tsconfig.json`
  - `src/lib/administration.ts`
  - `src/lib/deadlines.ts`
  - `src/lib/reports.ts`
  - `src/lib/pdf/receipt-generator.ts`
  - `src/components/admin/fee-management.tsx`
  - `src/server/services/payment.service.ts`
- **Chosen solution**:
  - Enabled `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`, `"allowJs": false` in `tsconfig.json`.
  - Safely fixed date-part destructuring and array indexing without unsafe `any` or `@ts-ignore` suppressions.
- **Tests added/changed**:
  - `pnpm typecheck` verified across the entire workspace.
- **Verification result**: Verified. `pnpm typecheck` passes with 0 errors.

---

### 12. Medium: ESLint Async/Promise Safety Rules

- **Issue**: Server and financial code needed lint-level protection against unhandled floating promises and misused async callbacks.
- **Affected files**:
  - `eslint.config.mjs`
  - `src/db/scripts/check-db.ts`
- **Chosen solution**:
  - Configured `@typescript-eslint/no-floating-promises: "error"` and `@typescript-eslint/no-misused-promises` for `src/server`, `src/db`, `src/app/api`, and `src/lib`.
  - Resolved unhandled promise in `check-db.ts` and migrated script to `pg.Client`.
- **Tests added/changed**:
  - `pnpm lint` verified.
- **Verification result**: Verified. `pnpm lint` passes with 0 errors.

---

### 13. Medium: Application Security Headers

- **Issue**: Next.js application responses lacked standard security headers, and production CSP included `'unsafe-eval'`.
- **Affected files**:
  - `next.config.ts`
  - `tests/unit/security-headers.test.ts`
- **Chosen solution**:
  - Configured `Content-Security-Policy` (with strict `'self' 'unsafe-inline'` in production, excluding `'unsafe-eval'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and conditional production `Strict-Transport-Security` in `next.config.ts`.
- **Tests added/changed**:
  - `tests/unit/security-headers.test.ts`: verified header key presence, production CSP restrictions, and route mapping.
  - `tests/e2e/smoke.spec.ts`: verified security headers on HTTP responses.
- **Verification result**: Verified. `pnpm test` and `pnpm build` pass.

---

### 14. Low: Remove Parent Portal N+1 Child Lookups

- **Issue**: `getParentChildren` queried parent-child IDs and then executed independent queries per child to load profiles and grade/section/school-year data.
- **Affected files**:
  - `src/server/services/portal.service.ts`
  - `tests/integration/code-review-remediation.test.ts`
- **Chosen solution**:
  - Replaced loop with single set-based joined query `selectParentChildrenProfiles` constrained by `guardians.userId = parentUserId`.
  - Batch-computed ledger balances and net payments via `selectLedgerTotals`.
- **Tests added/changed**:
  - `tests/integration/code-review-remediation.test.ts`: verified multi-child retrieval under parent ownership with deterministic sorting.
- **Verification result**: Verified. `pnpm portals-online:verify` passes.

---

### 15. Low: Refactor Oversized Modules

- **Issue**: `payment.service.ts` accumulated monolithic size across allocation logic and transaction orchestration.
- **Affected files**:
  - `src/server/services/payment-allocation.ts`
  - `src/server/services/payment.service.ts`
- **Chosen solution**:
  - Extracted allocation policies into `src/server/services/payment-allocation.ts` (`allocatePaymentToItems`, `allocatePaymentToObligations`, `groupAllocationsByAssessment`).
  - Re-exported all symbols from `payment.service.ts` for complete backwards compatibility.
- **Tests added/changed**:
  - `tests/unit/payments-receipts.test.ts`: existing test suite verified unchanged behavior.
- **Verification result**: Verified. `pnpm test` passes.

---

### 16. Low: Fix Payment-Proof Upload Keyboard Focus

- **Issue**: The custom image upload area did not visually indicate keyboard focus when users tabbed to the hidden file `<input>`.
- **Affected files**:
  - `src/components/ui/image-upload-field.tsx`
- **Chosen solution**:
  - Applied `peer` class to the file input and `peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:border-blue-500` to the bounding label.
- **Tests added/changed**:
  - Verified component structure and accessible labelling.
- **Verification result**: Verified.

---

### 17. Low: Add Password Show/Hide Control

- **Issue**: Portal login screens lacked a password visibility toggle.
- **Affected files**:
  - `src/components/auth/login-form.tsx`
  - `tests/unit/login-form.test.tsx`
- **Chosen solution**:
  - Added accessible `Eye`/`EyeOff` toggle button (`type="button"`, `aria-label="Show password" / "Hide password"`) switching input between `password` and `text`.
  - Maintained visual styling across admin, parent, and student login screens without logging or password leakage.
- **Tests added/changed**:
  - `tests/unit/login-form.test.tsx`: verified default `type="password"`, clicking toggles `type="text"` and aria-label, and button does not submit form.
- **Verification result**: Verified. All unit tests pass in `pnpm test`.

---

### 18. Low: Documentation Drift Cleanup

- **Issue**: Documentation contained outdated notes regarding database drivers and demo navigation defaults.
- **Affected files**:
  - `README.md`
  - `docs/architecture.md`
  - `docs/code-review-remediation.md`
  - `.env.example`
- **Chosen solution**:
  - Documented unified transaction-capable PostgreSQL adapter, opt-in demo navigation, recoverable notification leases, and migration 0009 contract.
- **Verification result**: Verified.
