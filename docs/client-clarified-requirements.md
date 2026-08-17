# Client-Clarified Requirements

## Accepted system scope

This repository is a single-school, fictional-data payment-monitoring demonstration. Its accepted workflow is:

- administrators and finance staff manage students, fee assessments, deadlines, announcements, payments, receipts, and audit history;
- parents and enabled student accounts view ledger-derived balances, assessment due dates, payment status, payment announcements, payment history, and manual GCash/Maya proof submissions;
- a parent submits the external-transfer amount, reference, timestamp, and a JPEG/PNG/WebP proof image;
- finance staff reviews the proof and either approves it into the authoritative ledger or rejects it with a reason;
- approval creates the persisted payment, ledger allocation, audit event, notification, and System-Generated Payment Receipt;
- rejection leaves the ledger balance unchanged and exposes the rejection reason to the submitting parent.

## Required presentation rules

- A zero ledger balance is displayed as **FULLY PAID**.
- A positive ledger balance is displayed as **WITH REMAINING BALANCE**.
- Unpaid assessments show their due date and one of **ON TRACK**, **DUE SOON**, or **OVERDUE**. A zero balance is never shown as overdue.
- Current portal announcements are published audience-matched announcements whose publish time has arrived and whose expiry has not passed. Expired, draft, and future announcements are not current dashboard content.
- User-facing receipts and PDFs are titled **System-Generated Payment Receipt**. They state: “This system-generated receipt records a payment verified in the school fees monitoring system. It is not an official tax receipt.”

## Explicitly out of scope

The system does not implement or claim to implement academic grades/gradebook data, attendance or absences, conduct, class participation, academic-performance analytics, impact tagging, restriction tracking, predictive analytics, or a general student-information system. Administrative grade levels used to organize fee structures are not academic results.

## Known boundaries

- GCash and Maya transfers happen outside the application. There is no GCash API, Maya API, automatic transfer verification, card integration, bank integration, or payment-provider integration.
- The legacy `MOCK_ONLINE` checkout/callback path remains only as historical test-harness coverage; it is not the normal parent payment flow and is disabled unless `ENABLE_MOCK_PAYMENT_HARNESS=true` is explicitly set for fictional CI/test use.
- Payment proof history stores the GCash/Maya destination snapshot captured at submission time. Legacy rows without that snapshot are labeled as unavailable rather than populated from current settings.
- Portal announcement reads are side-effect free. Draft, scheduled, expired, and archived records are not current portal content; scheduled publication is performed by the protected processor or explicit publish action.
- Scheduled reminder processing requires `CRON_SECRET`, and its declared Vercel cron schedule is configuration only—not deployment or delivery evidence.
- Receipts are fictional system-generated records, not official tax receipts or accounting documents.
- All demo records are fictional. No production-readiness, security certification, accounting approval, tax compliance, or deployment-success claim is made.

## Browser acceptance path

The hosted Playwright workflow covers admin announcement setup, parent balance and announcement visibility, GCash proof submission, pending status, finance proof preview and approval, updated balance and receipt wording, plus Maya submission, finance rejection, rejection reason visibility, and unchanged balance.
