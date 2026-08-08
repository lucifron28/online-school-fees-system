# Business Rule Assumptions

These are conservative assumptions for the fictional, single-school capstone demo. Any rule that affects financial behavior must remain explicit and testable.

## 1. Single school, currency, and timezone

- One school per deployment.
- Philippine peso values are stored as integer centavos (`PHP 1.00 = 100`).
- Date boundaries use `Asia/Manila`.
- The system uses fictional records only.

## 2. Payment allocation

Payments are allocated to the oldest outstanding assessment item first, in itemized order. The rule belongs in the server payment service and must be applied to authoritative database values.

## 3. Overpayments

Overpayments are rejected. The server calculates the current balance and does not trust a browser-supplied balance.

## 4. Reversals

Financial records are never hard-deleted. A reversal preserves the original payment, creates a compensating ledger entry, voids its receipt, and records an audit event.

## 5. Receipt wording

Receipts use the label **Payment Acknowledgment Receipt** and a fictional-demo disclaimer. The application must not use the phrase **Official Receipt**.

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

## 9. Current prototype boundary

Phase 1 migrations and database-contract checks are implemented and verified on isolated local PostgreSQL databases. Authenticated workflows, administration, database-backed financial transactions, ownership queries, reports, notifications, and deployment remain incomplete until their later phase gates pass. These assumptions must not be presented as already implemented until verified by integration and browser tests.
