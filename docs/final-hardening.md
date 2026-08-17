# Final pre-deployment hardening contract

This document records the final audit protections for the fictional, single-school demonstration. It is an implementation contract and test checklist; it is not evidence of deployment, production readiness, accounting approval, or real payment-provider certification.

## Payment boundaries

- The normal parent workflow is an external GCash/Maya transfer followed by manual proof submission. The proof upload is capped at 3 MiB at both the request boundary and the validated file boundary, and image signatures must match the declared MIME type.
- The payment destination name and account number are copied into the submission at proof creation. Review history reads that immutable snapshot. Older rows with no snapshot show an explicit historical-destination-unavailable state; current school settings are never substituted into old history.
- PostgreSQL checks enforce the destination snapshot shape and the `PENDING_VERIFICATION`, `APPROVED`, and `REJECTED` lifecycle contracts. Approval is the only state that may carry an approved payment; rejection requires a non-empty reason.
- The parent pay form derives the child, channel, and destination from one TanStack Form state, so the submitted values cannot drift from the visible selection.

## Mock payment harness

`MOCK_ONLINE` is a test harness, not a production payment integration. It is disabled by default and is rejected server-side for checkout creation, lookup, callback processing, payment posting, and the simulator page unless `ENABLE_MOCK_PAYMENT_HARNESS=true` is explicitly set. CI and Playwright set that flag only for their fictional regression fixtures. No GCash, Maya, card, bank, or automatic transfer-verification API is claimed.

## Announcements and scheduled processing

- Portal announcement reads are side-effect free and return only published, audience-matched, non-expired records.
- New announcements are created as draft or scheduled records and require an explicit publish action. Published edits remain published; archived records are terminal. The scheduled processor publishes due records and archives expired schedules with conditional updates and notification dedupe.
- `/api/internal/reminders/run` accepts `GET` and `POST` only with `CRON_SECRET` through `Authorization: Bearer ...` or `x-cron-secret`. It runs the shared announcement-and-reminder processor. `vercel.json` declares a conservative UTC schedule, but the file does not prove that a deployment exists or that a platform delivered a cron invocation.
- The admin reminder action authorizes both `ADMIN` and `FINANCE_STAFF` because it is a finance-operation processor, matching the protected internal route and its audit/test contract.

## Privacy, recipients, and pagination

- Notification recipient queries exclude inactive users. The console provider logs only delivery metadata and a truncated recipient hash; it never logs email addresses, subject text, message bodies, names, or financial content.
- Admin proof review, portal payment history, and finance collection reports use paginated responses. The UI displays page state and totals instead of rendering an unbounded table.

## Reviewer attribution and demo fixtures

- Migration `0008_normal_shotgun.sql` is a forward correction for the already-applied `0007` lifecycle migration. It clears unverifiable legacy submitter/self-review attribution while preserving the terminal decision, and permits an explicitly unknown reviewer as `NULL`; new approval and rejection paths still require the actual finance/admin reviewer.
- The disposable demo reset clears announcements and payment-proof rows before reseeding deterministic published announcements plus one approved GCash and one rejected Maya proof. Do not run the reset against a shared or production database.

## Verification checklist

The relevant local commands are:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Database verifiers and integration tests must use an isolated `TEST_DATABASE_URL`; no demo or production database reset is part of this hardening pass.
