# Client demo QA report

Run date: 2026-08-29T03:33:33.757Z
Base URL: https://online-school-fees.vercel.app
Viewport: 1440 x 900
Reference: DEMO-CLIENT-GCASH-20260829032659

## Result

PASSED: all planned captures completed.

## Browser checks

- Screenshot files: 132
- Page errors: 0
- Console errors: 0
- Unexpected HTTP responses: 0
- Request failures: 0
- Expected route responses: 0
- Native Playwright video: client-demo-desktop.webm

## Expected route responses

- None

## Errors

- Page errors: none
- Console errors: none
- Unexpected HTTP errors: none
- Request failures: none

## Data checks

- Only the four fictional demo accounts were used.
- The payment proof was submitted through the visible Parent UI.
- Finance approval was completed through the visible Finance UI and confirmation dialog.
- Receipt and payment history were checked in Parent, Student, and Administrator views.
- The test-only mock checkout route is intentionally disabled in production and was captured as the application Page Not Found screen.
- Passwords, cookies, and tokens were not entered into the recording page.
