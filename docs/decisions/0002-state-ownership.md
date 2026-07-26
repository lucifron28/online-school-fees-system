# ADR 0002: Explicit State Ownership Rules

## Status

Accepted

## Context

Complex applications often suffer from state duplication, stale UI data, and unpredictable bugs when multiple state management libraries overlap.

## Decision

We enforce strict, non-overlapping boundaries for state management across the application:

- Next.js App Router for URL segments and page routes.
- TanStack Query for remote client state.
- TanStack Form for client input and form state.
- Zod for input and schema validation.
- TanStack Table for table state (sorting, pagination, filtering).
- URL Search Params for shareable filter states.
- React `useState` for small, isolated UI component toggles.

## Consequences

- Eliminates global state clutter (no Redux, Zustand, or MobX needed).
- Clear rules for developers on where each type of state belongs.
