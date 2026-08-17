# Business Rule Assumptions

These are conservative assumptions for the fictional, single-school capstone demo. Any rule that affects financial behavior must remain explicit and testable.

## 1. Single school, currency, and timezone

- One school per deployment.
- Philippine peso values are stored as integer centavos (`PHP 1.00 = 100`).
- Date boundaries use `Asia/Manila`.
- The system uses fictional records only.

## 2. Payment allocation

Payments are allocated oldest-first across every positive outstanding obligation for the student. Assessment items and `DEBIT` adjustments are payable targets; `CREDIT` adjustments are never payment targets. The rule belongs in the server payment service and must be applied to authoritative database values. Each allocation stores exactly one assessment-item or debit-adjustment target.

## 3. Overpayments

Overpayments are rejected. The server calculates the current balance and does not trust a browser-supplied balance.

## 4. Reversals

Financial records are never hard-deleted. A reversal preserves the original payment, creates a compensating ledger entry, voids its receipt, and records an audit event.

## 5. Receipt wording

Receipts use the label **System-Generated Payment Receipt** and state: “This system-generated receipt records a payment verified in the school fees monitoring system. It is not an official tax receipt.” They are fictional system-generated records, not official tax or accounting documents.

## 6. Reset safety

- `DATABASE_URL` is the application/demo database.
- `TEST_DATABASE_URL` is a separate database used only by integration tests.
- `pnpm db:test:reset` refuses to run without `TEST_DATABASE_URL`, exact target equality, a different application URL, and `TEST_DB_RESET_CONFIRMATION=RESET_TEST_DATABASE`.
- `pnpm db:reset` refuses production mode, test-database targets, and missing `DEMO_DB_RESET_CONFIRMATION=RESET_DEMO`.

## 7. Assessment periods

- The default assessment period is **ANNUAL**.
- The database also supports `SEMESTER`, `TRIMESTER`, and `MONTHLY` periods for future fee structures.
- Assessment scope is unique per student, school year, and assessment period.

## 8. Database driver boundary

- Remote application URLs continue to use Neon through `@neondatabase/serverless`.
- Localhost PostgreSQL URLs use the node-postgres adapter so migration, seed, reset, and integration verification can run without a remote secret.

## 9. Authentication and authorization

- Better Auth email/password sign-up is disabled for public callers.
- `role` and `active` are server-controlled user fields; browser input cannot assign them.
- Portal redirects are fixed mappings from the stored role and never accept a caller-controlled callback URL.
- Admin and finance layouts accept `ADMIN` or `FINANCE_STAFF`; parent and student layouts require their exact role.
- Disabled users, unauthenticated requests, and wrong-role requests are rejected by server guards. Student access also respects `ENABLE_STUDENT_PORTAL`.
- Demo seed accounts use Better Auth's sign-up/password utilities and all use `DemoPass123!`.

## 10. Core administration

- Institution settings are singleton data for the single-school deployment and are persisted in `school_settings`.
- A deployment has at most one `ACTIVE` school year. Activating another year archives the previous active year and updates the institution setting in one transaction.
- Sections may reference draft or active school years, but never archived years. Grade and section codes are normalized to uppercase before uniqueness checks.
- Only `ADMIN` may manage institution settings, academic structure, and user roles/status. At least one active administrator must remain.
- User creation uses the server-side Better Auth sign-up utility with public sign-up still disabled.

## 11. Student, guardian, and fee-management rules

- `ADMIN` and `FINANCE_STAFF` may manage student, guardian, and fee records; parent and student accounts cannot enumerate these administrative records.
- Student numbers are case-normalized uppercase identifiers and must be unique.
- A student account link must reference a `STUDENT` user; a guardian account link must reference a `PARENT` user.
- A guardian/student pair may be linked once. A primary link is unique per student by transactionally locking the student, clearing prior primary flags, and enforcing a partial unique database index.
- Fee structures start as `DRAFT`, may become `ACTIVE` only for an active school year, and are archived instead of deleted. Posting and every fee-structure mutation use a common fee-structure row lock; assessment posting acquires locks in student-then-structure order.
- Fee categories used by a fee structure must be active at the time of assignment.
- Once a student assessment is `POSTED`, the fee structure definition and items are immutable; archiving remains allowed.

## 12. Assessment and ledger behavior

- Assessment posting uses the fee structure's configured period, with `ANNUAL` as the default.
- Only active students, active school years, and active fee structures can be posted.
- Fee names, categories, and integer-centavo amounts are copied into assessment items and are not recalculated from a later fee-structure edit.
- A student may have one assessment per school year and period. Duplicate generation is rejected by the service and database uniqueness constraint.
- Ledger balances are the sum of persisted debits minus persisted credits. Credit adjustments cannot make the balance negative, and all adjustments require a reason and approving user.

## 13. OTC payments, receipts, and reversals

- CASH and BANK_DEPOSIT payments are posted only by `ADMIN` or `FINANCE_STAFF` users.
- The server calculates the current ledger balance and allocates a payment to the oldest outstanding assessment items; browser-supplied balances and allocation values are ignored.
- A payment, its allocations, payment ledger entry, receipt, and audit events are committed in one transaction. The database-generated payment UUID is the source for receipt and verification identifiers.
- The idempotency key is required and unique. Replayed or concurrent submissions return the original persisted payment only when student, amount, method, and normalized reference match; semantic conflicts return a conflict response rather than silently replaying.
- Payments spanning multiple assessments set the nullable `payments.assessment_id` convenience field only when one assessment is represented, while ledger entries and reversal entries are grouped per represented assessment.
- Overpayments are rejected. Reversals preserve the original payment, create a compensating debit, void the linked receipt, and record the reversal reason and actor; double reversal is rejected.
- Receipt PDFs are generated from stored payment, allocation, receipt, student, institution, and status data. A reversed receipt is visibly marked voided.

## 14. Parent/student portals and manual payment proof

- A parent may view only students linked through the persisted guardian-to-student relationship for the authenticated `PARENT` user.
- A student may view only the student row linked to the authenticated `STUDENT` user. Caller-supplied student IDs, child lists, balances, and receipt ownership are not authorization evidence.
- Parents submit external GCash or Maya transfer details and a validated proof image; the submission is persisted in PostgreSQL and does not change the ledger while pending.
- The proof request and stored image are capped at 3 MiB, with a request-size guard, MIME/signature validation, and protected no-store/nosniff proof responses.
- The selected GCash/Maya destination name and account number are snapshotted on submission. Legacy null snapshots remain explicitly unavailable in history rather than being replaced by current settings.
- Finance approval rechecks ownership, amount, and current balance inside a transaction before using the shared payment service. Rejection requires a reason and leaves the ledger unchanged.
- The legacy mock checkout state, callback events, payment-channel binding, expiry, and idempotency keys remain persisted only for historical test-harness coverage and are disabled unless `ENABLE_MOCK_PAYMENT_HARNESS=true`. They do not represent a real provider integration or the normal parent flow.
- There is no GCash API, Maya API, automatic transfer verification, card network, bank integration, or payment-provider integration.

## 15. Reports and reconciliation

- Administrative reports are available only to `ADMIN` and `FINANCE_STAFF` users.
- Report date inputs are Manila calendar dates. The server converts the start of the selected day and the exclusive end of the selected day using `Asia/Manila` before querying PostgreSQL.
- Net collections include only `POSTED` payments. `REVERSED` payments remain visible in payment history and reversal reports and are excluded from dashboard and collection net totals.
- CSV exports use the same report result as the screen and prefix spreadsheet formula-looking cells with a text marker to prevent formula injection.
- A payment is `RECONCILED` when its persisted receipt exists and its persisted allocation total equals the payment amount. Missing or mismatched financial relationships are marked `REVIEW` with a note.
- Student statements and PDFs are generated from persisted ledger entries; the PDF remains a fictional demo document and is not an official tax or accounting record.

## 16. Notifications

- Assessment posting, successful payment, receipt availability, and reversal events create one persisted notification per linked student or guardian account.
- Notification dedupe keys include the event entity and recipient user, and the notification-delivery unique key prevents multiple channel rows for one notification.
- Resend is used only when both `RESEND_API_KEY` and `EMAIL_FROM` are configured. Local and CI environments use the console provider and do not require real email delivery.
- Inactive student and guardian users are excluded from recipient resolution. The console provider logs only delivery metadata and a truncated recipient hash, never message content or financial data.
- Delivery failures are recorded with attempt counts and retry timestamps. A provider failure is isolated from the already-committed financial transaction; manual retries use the persisted delivery row.
- Due dates and ON TRACK/DUE SOON/OVERDUE status are displayed for unpaid assessments. Zero-balance assessments are FULLY PAID and never overdue. Published, audience-matched payment announcements are visible in portal announcement pages and dashboard previews; expired, draft, scheduled, and archived announcements are excluded until explicit or scheduled publication. The protected processor requires `CRON_SECRET`; its Vercel schedule is configuration, not delivery evidence.

## 17. External Audit Round 3 financial-history rules

- Credit adjustments are assessment-scoped. A credit may not exceed the selected assessment's persisted net balance, even when another assessment leaves the student-wide total positive.
- Payment allocation consumes each assessment's net capacity after credits, then applies deterministic oldest-first target ordering within that capacity. Concurrent payment, adjustment, and reversal mutations serialize on the student row.
- Receipt issuance facts are immutable: version, issue time, receipt/verification identifiers, institution, student, payment, processor, allocations, and balance-after-payment are stored in a typed snapshot. Legacy receipts may have a null snapshot and must show an unavailable historical balance rather than a current balance.
- Outstanding reports include positive persisted debt for `ACTIVE`, `INACTIVE`, `WITHDRAWN`, and `GRADUATED` students. Existing debt may be paid by non-active students; only new assessment posting is active-only.
- Date-ranged statements use Manila boundaries and report opening balance, in-range activity, and closing balance. A statement without a range retains all-time behavior.
- Mock checkout terminal states are immutable. Repeated matching callbacks are idempotent; conflicting callbacks are retained as ignored/failed events and do not move money.

## 18. Current prototype boundary

Phase 1 migrations, Phase 2 authentication/RBAC, Phase 3 core administration, Phase 4 student/guardian/fee administration, Phase 5 assessment/ledger posting, Phase 6 OTC payment/receipt/reversal transactions, Phase 7 portal ownership/mock online-payment persistence, Phase 8 reports/reconciliation, Phase 9 notifications, Round 1 concurrency repair, and Round 2 financial-integrity repair are implemented and verified through hosted run #111. Round 3 is implemented and final-head verified through hosted Foundation run #123, with historical run #122 retained and PR #15 self-reviewed in COMMENT review `4892057781`; run #123 passed migration/seed/reset/verifiers, formatting, lint, typecheck, 57 unit tests, 46 integration tests, build, and 7 Playwright tests. Deployment and all payment-provider behavior remain fictional-demo boundaries; these assumptions must not be presented as production, accounting, security-certification, tax-receipt, or deployment evidence.

## 19. Final pre-deployment hardening boundaries

- Statement and receipt PDFs are complete fictional-demo documents: they paginate their persisted rows and preserve issuance semantics, but remain neither official tax receipts nor accounting records.
- Unexpected server logs contain only operational context, error class, and correlation ID. Runtime production authentication still requires a configured `BETTER_AUTH_SECRET`; the build-only placeholder exists only to keep static generation quiet.
- OTC student search is server-backed and bounded; the selected balance is re-read authoritatively before posting, and zero-balance students cannot be posted through the UI. Manual GCash/Maya proof review is separate from the legacy simulated mock-online flow.
- CASH/BANK_DEPOSIT processor names are authenticated staff snapshots; MOCK_ONLINE is labeled as the automated mock system. Receipt snapshots are historical facts and are not rewritten after user renames.

## 20. Final client-scope boundary

- The system is payment monitoring for a single fictional school. Academic grades/gradebook data, attendance/absences, conduct, class participation, academic-performance analytics, impact tagging, restriction tracking, predictive analytics, and general SIS behavior are explicitly out of scope. Administrative grade levels used to organize fee structures remain metadata.
- A positive ledger balance is WITH REMAINING BALANCE; a zero ledger balance is FULLY PAID. No mutable paid flag is stored.
- The complete accepted workflow and limitations are recorded in `docs/client-clarified-requirements.md`.
