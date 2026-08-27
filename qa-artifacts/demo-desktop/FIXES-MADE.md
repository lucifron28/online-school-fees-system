# Fixes made during the dry run

- Updated the deterministic demo seed to remove stale guardian-student links before reseeding. This prevents old QA children from appearing in the parent portal.
- Tightened the demo workflow integration assertion so the parent must have exactly `DEMO-0001` and `DEMO-0002` linked.
- Repeated the full workflow after each clean demo reset and used the current seeded `DEMO-0001` identifier for the final capture.
- Fixed the sidebar brand link so each role points to its real dashboard route instead of the nonexistent `/admin`, `/parent`, or `/student` route. This removed the repeated 404 prefetch errors seen by Playwright.
- The final native Playwright take completed the parent submission and Finance approval through the visible application UI, including the approval confirmation dialog. No page errors, console errors, HTTP errors, or horizontal overflow failures were observed.
