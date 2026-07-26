# Development Workflow

## Branch Lifecycle

1. **Branch Start:**
   - Inspect repo state and verify clean working tree.
   - Sync with `main`.
   - Create feature/chore branch (e.g., `feat/auth-rbac`).
   - Create implementation plan artifact and seek approval.

2. **Implementation:**
   - Write strict TypeScript code with full type coverage.
   - Respect state ownership boundaries.
   - Add unit tests for business logic and components.

3. **Verification:**
   - Run `pnpm format:check`
   - Run `pnpm lint`
   - Run `pnpm typecheck`
   - Run `pnpm test`
   - Run `pnpm build`
   - Run `pnpm test:e2e`

4. **Completion:**
   - Update documentation and ADRs.
   - Commit focused conventional commits.
   - Report status and wait for review before merging.
