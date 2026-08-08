# Goal Progress

## Current phase

- Phase: 2 - Authentication and RBAC
- Branch: `feat/12-auth-rbac`
- Starting main commit for this phase: `fc83f5ee6ea304abe1511a2c63f82c6eb591970b`
- Goal starting commit: `8bfcbb2618e2d7f38ee505fa167fa768c8663153`
- Current state: Better Auth sign-in, server-side role guards, protected layouts/Route Handlers, logout, compatible demo seeding, and local acceptance verification are implemented on this branch.

## Completed phases

- Phase 0 - Project Truth and Tooling - merged as PR [#1](https://github.com/lucifron28/online-school-fees-system/pull/1), merge commit `404291c608a0b0479fdb3e78af582d720065f409`.
- Phase 1 - Database Contract and Migrations - merged as PR [#2](https://github.com/lucifron28/online-school-fees-system/pull/2), merge commit `fc83f5ee6ea304abe1511a2c63f82c6eb591970b`.

## Phase 2 implementation

- Configured Better Auth with a Drizzle adapter, explicit base URL/secret handling, email/password sign-in, and `disableSignUp: true` for the public instance.
- Set `role` and `active` additional fields to `input: false`; invalid roles and inactive users fail closed.
- Added a Better Auth sign-in hook that rejects disabled users before a session is created.
- Added a shared TanStack Form + Zod login component for admin, parent, and student screens.
- Redirects are fixed mappings from the stored role: admin/finance to `/admin/dashboard`, parent to `/parent/dashboard`, and student to `/student/dashboard`.
- Added server layout guards, exact parent/student role checks, student portal feature-flag enforcement, and logout that revokes the session.
- Added finance/admin protection to the CSV report and receipt PDF Route Handlers. Health, Better Auth, and the mock payment webhook remain intentionally public integration boundaries.
- Reworked demo seeding to use Better Auth sign-up/password hashing utilities and the required fictional accounts/password.
- Added `pnpm auth:verify` for direct Better Auth acceptance checks and fixed-role routing tests.

## Commands and actual results

| Command                             | Result | Notes                                                                                                                                                                                            |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                    | Passed | Strict TypeScript passed after auth, layout, seed, and test changes.                                                                                                                             |
| `pnpm lint`                         | Passed | ESLint completed with exit code 0.                                                                                                                                                               |
| `pnpm test`                         | Passed | Unit/component suite passed; Phase 2 adds fixed role-routing coverage.                                                                                                                           |
| `pnpm build`                        | Passed | Next.js 15.5.21 compiled all 26 routes. A build without deployment envs emits Better Auth's expected missing-secret warning; the production server was separately run with `BETTER_AUTH_SECRET`. |
| `pnpm db:migrate`                   | Passed | Applied the committed migration to isolated `osfs_auth_phase2` PostgreSQL.                                                                                                                       |
| `pnpm db:seed`                      | Passed | Created all four demo accounts using Better Auth-compatible password hashing.                                                                                                                    |
| `pnpm auth:verify`                  | Passed | Verified four demo sign-ins, stored roles, invalid credentials, disabled-user rejection, session persistence, logout, and public sign-up rejection.                                              |
| HTTP unauthenticated report request | Passed | `/api/reports/csv` returned `401`.                                                                                                                                                               |
| HTTP parent session checks          | Passed | Parent login rendered the real seeded name, the parent report request returned `403`, and `/admin/dashboard` rendered a fixed `/unauthorized` redirect.                                          |
| HTTP logout check                   | Passed | Better Auth sign-out returned `200` with the required same-origin request headers; the subsequent report request returned `401`.                                                                 |

## Pull request evidence

Phase 2 will be pushed as `feat/12-auth-rbac`, reviewed, CI-verified, and merged with a merge commit before Phase 3 begins.

## Remaining work

- Complete Phases 3-10 in the requested branch/PR/merge sequence.
- Complete Phase 11 external audit preparation and final evidence report.

## Known blockers

- The local `gh` CLI token remains invalid; the connected GitHub app is required for PR creation, review, and merge.
- A real fictional Neon/test PostgreSQL URL is still required for remote deployment verification; isolated local PostgreSQL covers Phase 2 runtime acceptance.
