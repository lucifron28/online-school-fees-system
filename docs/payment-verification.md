# Manual GCash and Maya payment verification

The parent portal uses a manual proof workflow for GCash and Maya transfers. The application does
not initiate, query, or automatically confirm either provider transaction.

## Parent workflow

1. Finance staff enables a channel and configures the fictional school destination name and number
   under Administration → Institution profile.
2. A parent selects a linked child, reviews the server-calculated outstanding balance, transfers
   money externally, and submits the channel, amount, reference, timestamp, and screenshot.
3. The submission is stored as `PENDING_VERIFICATION`. The screenshot is validated as JPEG, PNG, or
   WebP, limited to 3 MiB, hashed with SHA-256, and stored in PostgreSQL bytea storage.
4. The parent can view only submissions they created for their linked children. Proof bytes are
   served through an authenticated, non-cacheable endpoint.

## Finance workflow

Finance staff and administrators review the queue, current balance, destination details, reference,
timestamp, and proof. Rejection requires a reason and creates no financial records.

Approval locks the submission and student, re-reads the authoritative ledger balance, rejects
overpayments or duplicate references, and uses the existing `PaymentService` transaction to create
the payment, allocations, ledger entry, receipt, audit log, and `GCASH` or `MAYA` method. The
submission is linked to the payment only after that transaction succeeds. A success notification is
sent after commit; pending and rejected states also notify the submitting parent.

## Test and deployment notes

- `pnpm payment-submissions:verify` runs a database-backed approval/reversal contract against the
  configured demo database and cleans up its fixture.
- `tests/integration/payment-submissions.test.ts` covers ownership, file validation, idempotency,
  duplicate-reference protection, rejection, overpayment rechecks, Maya/GCash posting, and
  concurrent approval.
- The existing mock checkout remains available only for internal test coverage. It is not the
  parent portal payment path.
