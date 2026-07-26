# 40 Testing and Quality Control

## Quality Pipeline Standards

All completed branches must pass the full local verification pipeline without error:

1. `pnpm format:check` — Prettier code formatting check
2. `pnpm lint` — ESLint strict rules
3. `pnpm typecheck` — TypeScript compiler strict check
4. `pnpm test` — Vitest unit & component tests
5. `pnpm build` — Next.js production build verification
6. `pnpm test:e2e` — Playwright end-to-end browser smoke test

## Testing Guidelines

- Never disable or skip failing tests without explicit documented approval.
- Use Playwright browser verification for any UI changes.
- Never write fake tests that assert dummy values (`expect(true).toBe(true)`).
