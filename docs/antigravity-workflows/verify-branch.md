# Verify Branch Workflow

Use this workflow to validate branch quality prior to completing a task.

## Instructions
1. **Review Criteria:** Check acceptance criteria of the current branch.
2. **Execute Pipeline:**
   - `pnpm format:check`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - `pnpm test:e2e`
3. **Browser Verification:** Start `pnpm dev`, open application in browser tools, test responsive layouts, check console logs.
4. **Diff Inspection:** Inspect `git diff` to ensure no stray or debug files are modified.
5. **Report Status:** State actual verification results honestly.
