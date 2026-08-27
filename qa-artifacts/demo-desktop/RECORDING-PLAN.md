# Core workflow desktop recording

Captured on 2026-08-27 against `https://online-school-fees.vercel.app` with a 1440×900 desktop viewport at 100% zoom. The screenshots and native Playwright video are 1440×900.

## Demo sequence

1. Administrator opens the dashboard, student directory, and fees view.
2. Parent opens the payment form with Alex Santos (`DEMO-0001`) selected, confirms the GCash destination, and submits the fictional proof.
3. Finance Staff opens Payment Proofs, checks the student, amount, destination, reference, and proof, then approves the pending proof.
4. Parent opens the approved proof and system-generated receipt.
5. Student opens the dashboard and payment history to verify the same posted payment and receipt.
6. Administrator opens Transactions and Reports to verify the posted payment and reconciliation totals.

## Captured desktop screens

- `01-admin-dashboard-clean.jpg`
- `02-admin-students-directory.jpg`
- `03-admin-fees-management.jpg`
- `04-parent-payment-form.jpg`
- `05-parent-payment-proofs-pending.jpg`
- `06-finance-payment-proofs-pending.jpg`
- `07-parent-receipt.jpg`
- `08-parent-dashboard-after-payment.jpg`
- `09-student-dashboard.jpg`
- `10-student-payment-history.jpg`
- `11-admin-transactions-posted.jpg`
- `12-admin-reports-reconciliation.jpg`
- `core-workflow-playwright.webm` — native Playwright `recordVideo` output, 1440×900, approximately 148 seconds at 25 fps.

## Recording notes

- Use the four seeded demo accounts only. Do not show passwords in the recording.
- The proof, payment, and account data shown here are fictional.
- If a core step errors or shows overflow, stop the take, capture the issue, fix it on a feature branch, reset and reseed the demo data, and restart from step 1.
- The WebM is a continuous desktop walkthrough recorded by Playwright from one Chromium browser context. It is not a slideshow assembled from screenshots.
