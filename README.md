# Online School Fees Monitoring and Payment System

> **Capstone Demonstration Notice:** This system is a single-school, fictional-data demonstration system developed for capstone audit and evaluation. It is not approved for real financial operations, government-recognized tax receipting, or live student data.

---

## Overview

The **Online School Fees Monitoring and Payment System** is a Next.js application built for educational institutions. It provides role-based user portals (Administrator, Finance Staff, Parent, and Student) for tracking student fee assessments, processing over-the-counter payments, simulating online gateway transactions, generating digital payment acknowledgment receipts, and rendering financial audit reports.

---

## 20-Screen Scaffold Baseline

The system includes a 20-screen UI scaffold accessible via the master navigation hub (`/`) and a quick-jump developer toolbar:

### 1. Authentication & Logins

- **Screen #1:** Admin Login (`/login/admin`)
- **Screen #9:** Parent Login (`/login/parent`)
- **Screen #15:** Student Login (`/login/student`)

### 2. Admin & Finance Portal

- **Screen #2:** Admin Dashboard (`/admin/dashboard`)
- **Screen #3:** Student Directory (`/admin/students`)
- **Screen #4:** Fees Management (`/admin/fees`)
- **Screen #5:** Over-The-Counter (OTC) Payment (`/admin/payments/manual`)
- **Screen #6:** Financial Transactions Log (`/admin/transactions`)
- **Screen #7:** Financial Reports & Statements (`/admin/reports`)
- **Screen #8:** Student Financial Profile (`/admin/students/S2024-0001`)
- **Screen #20:** Transaction Audit Detail (`/admin/transactions/OR-2024-000123`)

### 3. Parent Portal

- **Screen #10:** Parent Dashboard (`/parent/dashboard`)
- **Screen #11:** Child Account Details (`/parent/children/S2024-0001`)
- **Screen #12:** Simulated Online Payment (`/parent/pay`)
- **Screen #13:** Parent Payment Acknowledgment Receipt (`/parent/receipts/OR-2024-000123`)
- **Screen #14:** Parent Payment History (`/parent/history`)

### 4. Student Portal

- **Screen #16:** Student Dashboard (`/student/dashboard`)
- **Screen #17:** Student Account Statement (`/student/account`)
- **Screen #18:** Student Payment History (`/student/history`)
- **Screen #19:** Student Payment Receipt View (`/student/receipts/OR-2024-000123`)

---

## Capstone Roadmap & Branch Sequence

1. `fix/00-foundation-demo-contract` — Foundation, build safety, and demo contract
2. `feat/01-auth-core-settings` — Better Auth, RBAC, and institution settings
3. `feat/02-students-guardians-fees` — Student directory, guardian linking, fee templates
4. `feat/03-assessments-ledger` — Fee assessment generation, snapshots, ledger timeline
5. `feat/04-payments-receipts` — OTC payments, pdf-lib receipts, payment reversals, audit logs
6. `feat/05-parent-student-portals` — Parent & student read/pay views with ownership checks
7. `feat/06-mock-online-payment` — Simulated payment gateway abstraction & idempotent callbacks
8. `feat/07-dashboards-reports` — Dynamic financial analytics, CSV exports, ledger totals
9. `feat/08-demo-hardening-deployment` — Deterministic seeding, accessibility, Vercel readiness
10. `fix/09-final-internal-audit` — Comprehensive internal security, financial, and code audit

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) & React 19
- **Language:** TypeScript (Strict Mode)
- **Package Manager:** pnpm 11
- **Styling & UI:** Tailwind CSS, shadcn/ui primitives, Lucide icons
- **State & Forms:** TanStack Query, TanStack Form, TanStack Table
- **Schema Validation:** Zod
- **Database & ORM:** Neon Serverless PostgreSQL with Drizzle ORM
- **Authentication:** Better Auth
- **Testing:** Vitest, React Testing Library, Playwright E2E
- **CI/CD:** GitHub Actions workflow

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

4. **Start Development Server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration & Feature Flags

| Variable                      | Description                              | Default                             |
| ----------------------------- | ---------------------------------------- | ----------------------------------- |
| `DATABASE_URL`                | Neon PostgreSQL Connection String        | Optional for build; required for DB |
| `NEXT_PUBLIC_ENABLE_DEMO_NAV` | Toggle developer 20-screen quick toolbar | `true`                              |
| `ENABLE_STUDENT_PORTAL`       | Toggle student portal access             | `true`                              |
| `EMAIL_FROM`                  | Sender address for notifications         | `noreply@schoolfees.example.com`    |

---

## Available Scripts

- `pnpm dev` — Start development server
- `pnpm build` — Build production bundle
- `pnpm start` — Start production server
- `pnpm lint` — Run ESLint checks
- `pnpm typecheck` — Run TypeScript typecheck
- `pnpm format` — Format code with Prettier
- `pnpm test` — Run Vitest unit/component tests
- `pnpm test:e2e` — Run Playwright E2E smoke tests
- `pnpm db:check` — Verify database connection
