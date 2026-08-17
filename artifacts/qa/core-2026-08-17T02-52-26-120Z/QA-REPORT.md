# Core Feature QA — Passed (repair recheck)

Date: 2026-08-17

Viewport: Chromium desktop, 1440×900

Repository: `feature/qa-readiness-and-screenshot-refresh` at `e2f4fa7`

Production: [https://online-school-fees.vercel.app](https://online-school-fees.vercel.app)

Deployment: `dpl_9hqD4XNoWQDRmDXbnrHYR8FNVEZs` — Ready

## Result

Core acceptance passed locally and on the deployed production alias.

- Local: 36 desktop screenshots, 88 assertions, 0 failures.
- Production: 36 desktop screenshots, 88 assertions, 0 failures.
- The browser viewport was 1440×900; full-page desktop captures retain the 1440px desktop width and use content-dependent height.
- The replacement captures contain settled page content, no loading-state screenshots, and no stale approval/rejection action controls.

Covered workflows:

- Admin login and core admin routes.
- Announcement creation and parent visibility.
- Parent child ownership and outstanding balance.
- Finance staff cash payment posting, receipt PDF, parent history, and reversal.
- Student account and payment-history empty state.
- GCash proof submission, finance approval, fully-paid state, system-generated receipt, and reversal.
- Maya proof submission, finance rejection, rejection reason, and unchanged balance.
- Summary, collections, outstanding, reversals, and CSV reports.
- Anonymous and cross-role access denials.

## Repairs applied

- Applied Drizzle migrations `0005` and `0006` to the direct Neon database.
- Verified the migrated contract: 29 tables, 15 unique indexes, 14 checks, and financial delete protection.
- Added Vercel Production `DATABASE_DRIVER=pg` so transactional payment workflows use the Node PostgreSQL driver instead of the transaction-incompatible Neon HTTP driver.
- Added the same non-secret `DATABASE_DRIVER=pg` setting to local `.env.local`.
- Redeployed production and verified the deployment reached Ready.
- Configured fictional demo GCash/Maya destinations for proof-flow acceptance.
- Fixed payment-proof approval/rejection refresh behavior by awaiting query invalidation and clearing the completed selection.
- Replaced the spinner-only global loading fallback with a page-shell skeleton to prevent incomplete route captures.
- Hardened the desktop QA runner with route-specific readiness checks, settled-state assertions, strict heading locators, and clean screenshot focus handling.

## Supporting checks

- ESLint: passed.
- TypeScript typecheck: passed.
- Unit tests: 72 passed.
- Production build: passed.
- Database connection: passed.
- Migration verifier: passed after migrations.
- Integration suite: 3 reset-safety tests passed; 62 database-backed tests remain skipped because `TEST_DATABASE_URL` is not configured.
- Format check: existing baseline failure across 231 files; no formatting changes were made during QA.

## Final QA data state

- Latest QA pass leaves no pending proof submissions from the test flow; payment test records are reversed or rejected as appropriate, and generated announcements are archived.
- Demo GCash and Maya settings remain enabled with fictional account details.

## Evidence

- [QA report](./QA-REPORT.md)
- [Production runner results](./deployed/desktop-core-qa-results.json)
- [Local runner results](./local/desktop-core-qa-results.json)
- [Production desktop screenshots](./deployed/)
- [Local desktop screenshots](./local/)
