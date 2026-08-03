# Business Rule Assumptions

This document records every conservative, reversible business-rule assumption made during the implementation of the Online School Fees Monitoring and Payment System.

---

## 1. Single-School & Single-Currency Baseline

- **Decision:** The system operates as a single-school system in Philippine Pesos (PHP, ₱) with timezone `Asia/Manila`.
- **Reason:** Project scope defines a single-school demonstration environment.
- **User-visible Effect:** Currency is formatted with ₱ symbol and two decimal places (integer centavos stored internally).
- **Location:** `src/lib/utils/currency.ts`, `src/lib/constants/institution.ts`.
- **Changeability:** Configurable via institution settings record.

## 2. Payment Allocation Rule

- **Decision:** Over-the-counter and online payments are allocated to the oldest unpaid/partially paid assessment fee items first in itemized sequence.
- **Reason:** Standard educational accounting practice to resolve prior obligations before current term fees.
- **User-visible Effect:** Payments automatically clear Tuition/Enrollment fees prior to optional/ancillary fees.
- **Location:** `src/server/services/payment.service.ts`.
- **Changeability:** Logic centralized in payment service.

## 3. Overpayment Policy

- **Decision:** Reject payments exceeding the selected student's total outstanding balance.
- **Reason:** Prevents unallocated credit handling complexities in the demo scope.
- **User-visible Effect:** Users attempting to enter an amount greater than the total balance receive an input validation error.
- **Location:** `src/lib/validation/payment.ts`.
- **Changeability:** Centralized validation schema.

## 4. Payment Reversals & Compensation

- **Decision:** Financial records are never hard-deleted. Correcting a posted payment creates a compensating reversal record, voids the receipt, restores the assessment balance, and logs an audit entry.
- **Reason:** Audit compliance and financial traceability invariants.
- **User-visible Effect:** Original payment remains visible in history marked as "REVERSED", with balance restored.
- **Location:** `src/server/services/reversal.service.ts`.
- **Changeability:** Enforced by service layer and database schema.

## 5. Official Receipt Disclaimer

- **Decision:** Generated receipts are labeled "Payment Acknowledgment Receipt" with a prominent demo disclaimer.
- **Reason:** Disclaims government/tax-recognized official receipt status for capstone demonstration safety.
- **User-visible Effect:** PDF and web receipt views state "Payment Acknowledgment Receipt — Fictional Demo System".
- **Location:** `src/lib/pdf/receipt-generator.ts`, receipt component views.
- **Changeability:** Configurable via institution settings.
