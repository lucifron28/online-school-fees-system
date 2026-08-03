# Online School Fees Monitoring and Payment Information System

**Branch Baseline:** `chore/project-foundation`

---

## Project Overview

The **Online School Fees Monitoring and Payment Information System** is a modern web application designed for educational institutions. It provides student fee assessment tracking, over-the-counter and simulated online payments, digital receipts, parent ledger access, cashier dashboards, and financial audit logs.

This repository baseline (`chore/project-foundation`) contains the **technical foundation only**. Business domain features (authentication, student records, fee assessments, payments) will be built in subsequent feature branches.
---

## Tech Stack Baseline

- **Framework:** Next.js (App Router) with React 19
- **Language:** TypeScript (Strict Mode)
- **Package Manager:** pnpm
- **Styling:** Tailwind CSS & shadcn/ui
- **Icons:** Lucide React
- **Remote State:** TanStack Query
- **Form & Tables:** TanStack Form, TanStack Table
- **Schema Validation:** Zod
- **Database:** Neon PostgreSQL serverless driver with Drizzle ORM
- **Authentication:** Better Auth (installed, configuration prepared)
- **Testing:** Vitest, React Testing Library, Playwright (Chromium E2E smoke tests)
- **CI/CD:** GitHub Actions workflow (`.github/workflows/ci.yml`)

---

## Prerequisites

- **Node.js:** `>=20.0.0` (Active LTS pinned via `.node-version`)
- **pnpm:** `>=9.0.0`

---

## Local Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/lucifron28/online-school-fees-system.git
   cd online-school-fees-system
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**

   ```bash
   cp .env.example .env.local
   ```

   _(Edit `.env.local` with your Neon PostgreSQL `DATABASE_URL` when testing database operations)._

4. **Start Development Server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available pnpm Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Starts Next.js development server        |
| `pnpm build`        | Builds application for production        |
| `pnpm start`        | Starts production server                 |
| `pnpm lint`         | Runs ESLint checks                       |
| `pnpm typecheck`    | Runs TypeScript compiler checks          |
| `pnpm format`       | Formats code with Prettier               |
| `pnpm format:check` | Verifies code formatting                 |
| `pnpm test`         | Runs unit & component tests with Vitest  |
| `pnpm test:watch`   | Runs Vitest in watch mode                |
| `pnpm test:e2e`     | Runs Playwright E2E smoke test           |
| `pnpm test:e2e:ui`  | Opens Playwright UI test runner          |
| `pnpm db:generate`  | Generates Drizzle database migrations    |
| `pnpm db:migrate`   | Executes database migrations             |
| `pnpm db:studio`    | Opens Drizzle Studio GUI                 |
| `pnpm db:check`     | Executes manual database connection test |

---

## Architecture & State Ownership Rules

1. **App Router:** Owns application routing and page segments.
2. **Server Components:** Preferred by default unless client interactivity is required.
3. **TanStack Query:** Owns remote/server state in Client Components.
4. **TanStack Form:** Owns form state and input management.
5. **Zod:** Owns shared validation schemas.
6. **TanStack Table:** Owns complex table sorting, filtering, and pagination.
7. **PostgreSQL + Drizzle:** Owns persistent data. Ledger entries are append-only.
8. **URL Params:** Own shareable filter, search, and pagination state.

---

## Git Workflow & Branching

- **Main Branch:** `main` (clean, stable releases)
- **Current Foundation Branch:** `chore/project-foundation`
- **Next Planned Branch:** `feat/auth-rbac` (Authentication & RBAC setup with Better Auth)

---

## Current Limitations

- No domain database tables or migrations exist yet (tables will be introduced in feature branches).
- Authentication, login forms, and user permissions are not yet active (scheduled for `feat/auth-rbac`).
- Payment gateway integration and email sending are unconfigured mock interfaces for foundation testing.
