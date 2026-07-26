# ADR 0003: PostgreSQL and Drizzle ORM Selection

## Status

Accepted

## Context

Financial records require strict ACID compliance, transactional guarantees, exact decimal precision, and zero data corruption.

## Decision

We select Neon PostgreSQL (serverless PostgreSQL) as the database engine and Drizzle ORM for schema definition, queries, and migrations.

## Consequences

- Full SQL control with standard TypeScript type safety.
- Native support for Neon serverless HTTP connection pool.
- Lightweight runtime overhead compared to heavier ORMs like Prisma.
- Clean database migration management via Drizzle Kit.
