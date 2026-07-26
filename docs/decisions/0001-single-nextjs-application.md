# ADR 0001: Single Next.js Application Architecture

## Status

Accepted

## Context

The Online School Fees System for Mother Perpetua Parochial School requires an administrative web application, cashier interface, parent portal, and financial reporting engine.

## Decision

We choose a single monolithic Next.js App Router application in TypeScript rather than splitting frontend and backend into separate microservices or repositories.

## Consequences

- Single unified build process and deployment target on Vercel.
- Direct invocation of server services within Server Components, eliminating unnecessary internal HTTP latency.
- Simplified code sharing for types, Zod schemas, and utilities between frontend and backend layers.
