# Architecture Overview

## Project Architecture

The **Online School Fees Monitoring and Payment Information System** for **Mother Perpetua Parochial School** is structured as a unified Next.js App Router application written in TypeScript.

```
src/
├── app/                  # Next.js App Router pages, layouts, and API routes
│   ├── api/
│   │   └── health/      # Health check Route Handler
│   ├── globals.css      # Tailwind CSS root tokens
│   ├── layout.tsx       # Root layout with QueryProvider
│   └── page.tsx         # Neutral foundation homepage
├── components/           # UI Components
│   ├── ui/              # Primitive shadcn UI components (Button, Card, Badge, Separator)
│   └── shared/          # Shared layout & visual elements
├── db/                   # Database layer
│   ├── schema/          # Drizzle ORM table definitions
│   ├── scripts/         # Connection check script
│   └── index.ts         # Lazy Drizzle client initialization
├── features/             # Business feature modules (Auth, Fees, Ledger, Payments)
├── lib/                  # Shared utilities & helpers
│   ├── env/             # Zod environment variable validation
│   ├── query/           # TanStack Query client & provider
│   └── utils/           # Utility functions (cn)
├── server/               # Server-side business logic
│   ├── errors/          # Application error hierarchy
│   └── services/        # Service layer entrypoints
└── types/                # Global TypeScript definitions
```

## Layered Data Flow

All feature requests follow a clean unidirectional flow:

`Route Handler / Server Action` -> `Zod Input Validation` -> `Authorization Check` -> `Server Service` -> `Drizzle ORM Query` -> `PostgreSQL`

## Key Architectural Decisions

1. **Monolithic Next.js Application:** Single repository containing both UI and API handlers. No microservices or separate backend service.
2. **Server-Side Render Preference:** React Server Components are used by default to fetch data directly from services, avoiding client-side fetching overhead where interactive state is unnecessary.
3. **Strict State Ownership Boundaries:** Client state is cleanly separated between Query, Form, Table, URL, and React local state.
