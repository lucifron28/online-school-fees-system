# 10 Architecture & Structure

## Stack Foundation

- Next.js App Router with TypeScript (strict mode enabled)
- Single monolithic web application (no separate backend service, no microservices)
- Feature-oriented directory organization under `src/features/`

## Control Flow Scoping

All feature request handling follows strict layered scoping:
`Route Handler` -> `Zod Input Validation` -> `Authorization Check` -> `Server Service` -> `Drizzle ORM Database Query`

## Principles

- **Server Components:** Prefer Server Components by default. Use Client Components only when browser interactivity or hooks are required.
- **No Logic in UI:** React components must not contain raw business calculations or direct database invocations.
- **Dependencies:** Prohibited from adding extra backend frameworks, microservice frameworks, or alternative state managers.
