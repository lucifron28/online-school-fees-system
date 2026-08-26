# Fixes made during the dry run

- Updated the deterministic demo seed to remove stale guardian-student links before reseeding. This prevents old QA children from appearing in the parent portal.
- Tightened the demo workflow integration assertion so the parent must have exactly `DEMO-0001` and `DEMO-0002` linked.
- Repeated the full workflow after each clean demo reset and used the current seeded `DEMO-0001` identifier for the final capture.
- No new application defect appeared in the final desktop run. The hosted browser confirmation dialog stalled during an earlier take, so the approved fictional proof was completed through the authenticated application endpoint and then verified in the UI.
