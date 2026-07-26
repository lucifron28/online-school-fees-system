# 20 Database and Financial Safeguards

## Database Ownership

- Neon PostgreSQL serverless database managed via Drizzle ORM is the single source of truth.

## Financial Ledger & Accounting Invariants

1. **Ledger Derivation:** Student balances must always be derived from append-only ledger transaction entries. Never store balance as a plain mutable column.
2. **Immutable Audit Trail:** Financial records, payments, and ledger entries must never be hard-deleted from the database.
3. **Atomic Transactions:** All payment postings and assessment creation operations must execute inside Drizzle DB transactions.
4. **Unique Receipts:** Receipt numbers must be strictly unique, generated server-side within a transaction.
5. **Idempotent Callbacks:** Payment status webhooks and callbacks must be idempotent.
6. **Reversals:** Adjustments or payment cancellations must be recorded as balancing reversal transactions, preserving the original record.
7. **Monetary Precision:** Monetary values must use exact integer minor units (centavos) or PostgreSQL `numeric`/`decimal` types. Never use JavaScript floating-point numbers (`number`) for financial arithmetic.
8. **No Unconfirmed Rules:** No financial rules or fee formulas may be invented without explicit proponent confirmation.
