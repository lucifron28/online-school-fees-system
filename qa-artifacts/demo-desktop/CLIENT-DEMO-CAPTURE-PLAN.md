# Client demo capture plan

## Purpose

Create a complete desktop review package for the client. The package will show every user-facing screen in the system, the important state changes in the payment workflow, and the long tables at readable scroll positions.

This is a capture plan. No new recording starts until the plan is approved.

## Final package

The completed package will contain:

- One continuous native Playwright desktop recording of the walkthrough.
- One Playwright screenshot for every route listed in the screen manifest below.
- Additional screenshots for pending, approved, rejected, and post-payment states where those states change what the client sees.
- Top, middle, and bottom scroll captures for long pages and tables. These remain separate browser screenshots. They will not be stitched into a fake slideshow frame.
- A screenshot index with the route, account, state, and capture filename for every image.
- A short QA report recording the viewport, data state, checks, and any known exclusions.

All records shown in the package will be fictional demo data.

## Accounts and demo data

Use only the seeded demo accounts:

| Role               | Account               | Main records shown                                            |
| ------------------ | --------------------- | ------------------------------------------------------------- |
| Administrator      | `admin@demo.school`   | All administration, student, fee, payment, and report screens |
| Finance Staff      | `finance@demo.school` | Finance screens with restricted navigation                    |
| Parent or guardian | `parent@demo.school`  | Alex Santos, `DEMO-0001`                                      |
| Student            | `student@demo.school` | Alex Santos, `DEMO-0001`                                      |

The shared demo password will stay in the local runner environment. It must not appear in a screenshot, video frame, filename, log, or client document.

Before the capture, reset the demo records from the repository root:

```powershell
$env:DEMO_DB_RESET_CONFIRMATION = 'RESET_DEMO'
pnpm db:reset
```

After the reset, confirm the following before opening the first screen:

1. The four accounts can authenticate.
2. The parent account is linked to the expected seeded children.
3. Alex Santos is returned as `DEMO-0001`.
4. Alex has an unpaid balance and no new payment proof from this run.
5. The active school year, fee structure, assessment, and demo payment history load.

The reset is part of the recording procedure. If the take must restart, reset the demo records again so the client sees the same starting state.

## Browser and recording settings

Use a real Chromium browser controlled by Playwright.

- Browser: Chromium
- Viewport: 1440 x 900
- Device scale factor: 1
- Zoom: 100 percent
- Theme: light
- Locale: English, with `Asia/Manila` time handling
- Browser chrome: excluded from screenshots and video
- Video: Playwright `recordVideo` from one browser context
- Video size: 1440 x 900
- Screenshot mode: `page.screenshot`, `fullPage: false` for viewport captures

Use API authentication only to establish a session without displaying passwords. Use the visible application UI for payment submission, proof review, confirmation, approval, receipt opening, navigation, and the client-facing actions being demonstrated.

Do not use an OS screen recorder, an in-app browser screenshot tool, a screenshot slideshow, or a video assembled from still images.

## Capture procedure for every screen

Run these steps for every route in the manifest.

1. Start or reuse the Playwright Chromium context at 1440 x 900.
2. Authenticate as the role listed for the screen without showing the password.
3. Navigate to the exact route.
4. Wait for the route to finish loading and for its primary heading and data state to be visible.
5. Check that the page has no unexpected error banner, loading spinner, failed data request, or browser page error.
6. Check the document and visible panels for horizontal overflow. A table may have an intentional internal scroll area, but text and controls must not be clipped.
7. Capture the normal viewport screenshot.
8. If the screen scrolls, capture the top, middle, and bottom positions. Capture every pagination state needed to show the complete seeded table.
9. Add the route, account, state, viewport, and filename to the screenshot index immediately.
10. Leave the browser at the next screen in the sequence so the video shows a real transition.

For a long page, use the page's actual scroll container. The admin, parent, and student layouts use an internal main-area scroll region, so a single browser `fullPage` image may not include all of the table. The capture runner must scroll that region and save separate top, middle, and bottom images instead.

## Screen manifest

The following 39 route screens are in scope. Dynamic IDs must be discovered from the current seeded data and the payment created during this run. Do not hardcode a stale student, transaction, receipt, or submission ID.

### Public and authentication screens

| ID      | Route            | Account or state                  | Required capture                                                                |
| ------- | ---------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| PUB-01  | `/`              | Anonymous                         | Portal selection and public system description                                  |
| AUTH-01 | `/login/admin`   | Anonymous                         | Administrator login screen with the demo email visible and password empty       |
| AUTH-02 | `/login/parent`  | Anonymous                         | Parent login screen with the demo email visible and password empty              |
| AUTH-03 | `/login/student` | Anonymous                         | Student login screen with the demo email visible and password empty             |
| SEC-01  | `/unauthorized`  | Deliberately unauthorized session | Access-denied screen, captured only through a controlled role restriction check |

### Administrator screens

Use `admin@demo.school` for these screens. Capture the initial seeded state before the new payment, then recapture the affected transaction and report screens after approval.

| ID     | Route                              | Required state or focus                                                                                                                                |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADM-01 | `/admin/dashboard`                 | Summary cards, recent activity, payment-proof shortcut, and reports shortcut                                                                           |
| ADM-02 | `/admin/students`                  | Student directory, search, filters, table rows, pagination, and long-table scroll positions                                                            |
| ADM-03 | `/admin/students/{DEMO-0001}`      | Alex Santos profile, assessment, balance, ledger, and guardian details                                                                                 |
| ADM-04 | `/admin/guardians`                 | Guardian directory, linked-student information, search, and long-table scroll positions                                                                |
| ADM-05 | `/admin/fees`                      | Fee categories, fee structures, assessment periods, statuses, and table scroll positions                                                               |
| ADM-06 | `/admin/payments/manual`           | Manual payment form, student search, balance panel, payment method, amount, and receipt controls. Do not post a second payment during this capture.    |
| ADM-07 | `/admin/payment-submissions`       | Pending proof queue, selected proof details, destination, reference, amount, proof preview, and review controls                                        |
| ADM-08 | `/admin/transactions`              | Posted and reversed transactions, search/filter controls, receipt numbers, statuses, and long-table scroll positions                                   |
| ADM-09 | `/admin/transactions/{payment-id}` | The new posted payment detail, allocations, receipt, balance after payment, and audit information                                                      |
| ADM-10 | `/admin/reports`                   | Summary totals, collection history, outstanding balances, reversals, deadlines, reconciliation status, downloads, and every long-table scroll position |
| ADM-11 | `/admin/notifications`             | Notification list, statuses, timestamps, and available actions                                                                                         |
| ADM-12 | `/admin/announcements`             | Announcement list, draft/published state, audience, dates, editor, and table scroll positions                                                          |
| ADM-13 | `/admin/users`                     | User list, role badges, account status, and administration controls                                                                                    |
| ADM-14 | `/admin/settings`                  | School settings, school year, grade level, section, receipt prefix, and configuration panels                                                           |

### Finance Staff screens

Use `finance@demo.school`. These routes share the admin shell, but the capture must show the Finance Staff identity and restricted navigation.

| ID     | Route                        | Required state or focus                                                             |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------- |
| FIN-01 | `/admin/dashboard`           | Finance Staff identity, finance summary, and absence of administrator-only controls |
| FIN-02 | `/admin/payments/manual`     | Finance payment form and current balance lookup                                     |
| FIN-03 | `/admin/payment-submissions` | Pending proof queue before approval and the selected proof detail                   |
| FIN-04 | `/admin/transactions`        | Finance transaction log and receipt links                                           |
| FIN-05 | `/admin/reports`             | Finance reports and reconciliation tables                                           |

The Finance Staff screenshots must also verify that `Users` and `Settings` are not available in the Finance navigation. Do not create duplicate copies of screens that are visually identical unless the role badge, permissions, or visible controls differ.

### Parent and guardian screens

Use `parent@demo.school`. Capture both the initial unpaid state and the state after the proof is approved.

| ID     | Route                               | Required state or focus                                                                                                                   |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PAR-01 | `/parent/dashboard`                 | Linked children, Alex Santos balance, outstanding status, notices, and initial state                                                      |
| PAR-02 | `/parent/children/{DEMO-0001}`      | Child account summary, assessment items, balance, ledger, and recent payments                                                             |
| PAR-03 | `/parent/history`                   | Child payment history, receipt links, search/filter state, and long-table scroll positions                                                |
| PAR-04 | `/parent/pay?studentId={DEMO-0001}` | GCash selected, destination details, amount field, reference field, transaction date, upload control, and proof preview before submission |
| PAR-05 | `/parent/payment-submissions`       | Newly submitted proof in `PENDING VERIFICATION` state, including the unchanged balance                                                    |
| PAR-06 | `/parent/payment-submissions`       | The same proof in `APPROVED` state, with the system-generated receipt link                                                                |
| PAR-07 | `/parent/receipts/{receipt-id}`     | System-generated receipt, receipt number, payment details, allocation, balance after payment, and disclaimer                              |
| PAR-08 | `/parent/notifications`             | Parent notification list, payment-related notice, status, and timestamps                                                                  |
| PAR-09 | `/parent/announcements`             | Parent-facing announcement list and announcement details                                                                                  |
| PAR-10 | `/parent/pay/mock-checkout`         | Capture only if the route is reachable. Mark it as test-only or disabled in the index. It is not part of the production payment workflow. |

### Student screens

Use `student@demo.school`. Capture the initial state where applicable, then the updated payment history and receipt after approval.

| ID     | Route                            | Required state or focus                                                       |
| ------ | -------------------------------- | ----------------------------------------------------------------------------- |
| STU-01 | `/student/dashboard`             | Alex's account summary, balance, assessment status, and notices               |
| STU-02 | `/student/account`               | Assessment detail, fee items, ledger, and balance                             |
| STU-03 | `/student/history`               | Posted payment history, receipt link, status, and long-table scroll positions |
| STU-04 | `/student/receipts/{receipt-id}` | Same system-generated receipt visible to the student                          |
| STU-05 | `/student/notifications`         | Student notification list and payment-related notice                          |
| STU-06 | `/student/announcements`         | Student-facing announcement list and details                                  |

## Payment workflow to record visibly

This is the main client walkthrough. The payment and approval actions must happen through visible Playwright UI interactions.

1. Open the Administrator dashboard and capture the starting summary.
2. Open Students, locate Alex Santos, `DEMO-0001`, and capture the directory and profile screens.
3. Open Fees Management and capture the active fee structure and assessment information.
4. Sign in as Parent without showing the password.
5. Open the parent dashboard and Alex's child detail page. Capture the starting unpaid balance.
6. Open Make Payment for `DEMO-0001`.
7. Select `GCASH` so the configured demo destination is visible.
8. Enter the fictional amount `100.00` PHP.
9. Enter a unique fictional reference such as `DEMO-RECORDING-GCASH-{run-stamp}`.
10. Enter a valid transaction date and time.
11. Upload the fictional payment proof image through the visible file input.
12. Capture the completed form before submission.
13. Click `Submit payment proof` in the UI.
14. Capture the pending state. The balance must still be unchanged and the page must show `PENDING VERIFICATION`.
15. Switch to Finance Staff without showing the password.
16. Open Payment Proofs, search for the unique reference, select the row, and capture the review panel.
17. Check the student, channel, amount, destination, reference, paid time, submitted time, and proof preview in the UI.
18. Click `Approve and post payment`.
19. Accept the confirmation dialog through Playwright.
20. Capture the approval confirmation and the updated queue state.
21. Switch back to Parent and capture the approved submission, updated balance, and system-generated receipt.
22. Switch to Student and capture the dashboard, account, payment history, and the same receipt.
23. Switch to Administrator and capture Transactions, the transaction detail, and Reports with the new payment reconciled.
24. Return to the final receipt or Reports screen for the last frame of the recording.

The runner must discover the resulting receipt ID, transaction ID, receipt number, and updated balance from the application response or visible page. The screenshot index must record those values so the client can match the same payment across all four roles.

## Long-table capture rules

The following screens require more than one screenshot when their content exceeds the 900-pixel viewport:

- Administrator Students, Guardians, Fees, Payment Proofs, Transactions, Reports, Notifications, Announcements, Users, and Settings.
- Finance Payment Proofs, Transactions, and Reports.
- Parent History and Payment Proof Submissions.
- Student Payment History.
- Any detail screen whose ledger or assessment list continues below the fold.

For each long screen:

1. Capture the top of the content with the page heading and filters visible.
2. Scroll the correct internal content region to the middle and capture it.
3. Scroll to the bottom and capture the last rows, pagination, totals, or action controls.
4. If a table has pagination, capture each page needed to show the seeded records.
5. If a table has intentional horizontal scrolling, capture the default view and the right-side columns. Confirm that no text is clipped at either position.
6. Record the scroll position or pagination state in the screenshot index.

Do not crop out headers, filters, totals, pagination, or action buttons just to make a table fit in one image.

## Screenshot names

Use stable names that match the manifest. Examples:

```text
ADM-02-students-top.jpg
ADM-02-students-middle.jpg
ADM-02-students-bottom.jpg
PAR-04-payment-form-gcash-filled.jpg
PAR-05-payment-submission-pending.jpg
FIN-03-payment-proof-review-pending.jpg
PAR-07-receipt-approved.jpg
STU-03-payment-history-post-approval.jpg
ADM-10-reports-collections-bottom.jpg
```

Every screenshot must be a direct Playwright capture at 1440 x 900. Use JPEG for the client review set unless a proof preview requires PNG clarity.

## Recording chapters

The video remains one native Playwright recording, with these chapters in order:

1. Public portal and login screen context.
2. Administrator setup and records.
3. Parent payment submission.
4. Finance Staff proof review and approval.
5. Parent receipt and updated account.
6. Student verification.
7. Administrator Transactions and Reports.
8. Final clean receipt or reconciliation screen.

Pause on each screen long enough for a client to read the heading, main values, status badges, and primary action. Use a short pause after every visible state change. Do not cut the video between screenshots or replace a page with a still frame.

## Automated QA gates

The recording run is accepted only when all of these checks pass:

- Every manifest route was visited or explicitly marked as test-only.
- Every required state screenshot exists in the screenshot index.
- Every screenshot is 1440 x 900 and opens successfully.
- The WebM is produced by Playwright `recordVideo` and has 1440 x 900 video frames.
- The video contains the actual browser actions and page transitions.
- No password, cookie, token, or private environment value appears in any artifact.
- No unexpected `pageerror` event occurred.
- No unexpected browser console error occurred.
- No unexpected failed request or HTTP response at or above 400 occurred. Deliberate 401, 403, and the controlled unauthorized screen must be labelled as expected.
- No page has accidental horizontal overflow, clipped controls, hidden table columns, or overlapping text at the desktop viewport.
- The parent balance is unchanged while the proof is pending.
- Finance approval creates one posted payment and one system-generated receipt.
- The same payment, receipt number, reference, and updated balance appear in Parent, Student, Transactions, and Reports.
- The final seeded data values in the screenshots match the screenshot index.

## Restart rule

If any core step fails, if a page shows an error, if a table overflows, if a control is clipped, if a proof does not appear, or if the video contains a password or wrong account:

1. Stop the recording immediately.
2. Save the failed screenshot and the exact route, role, and error message in the QA notes.
3. Fix the application or the capture runner on the feature branch.
4. Run the relevant code checks.
5. Reset and reseed the demo data.
6. Start again from `PUB-01`, not from the failed screen.
7. Replace the failed screenshot set and video only after the complete run passes.

## Client handoff

The handoff folder will contain:

- `client-demo-desktop.webm`
- `SCREENSHOT-INDEX.md`
- The complete screenshot folder, including scroll-position variants
- `CLIENT-QA-REPORT.md`
- `CLIENT-DEMO-CAPTURE-PLAN.md`

The client note should say that the records are fictional, the video was recorded in a 1440 x 900 desktop browser, the payment proof was manually submitted and approved in the UI, and the receipt and balance were checked in the Parent, Student, Finance Staff, and Administrator views.
