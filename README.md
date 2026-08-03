# Online School Fees Monitoring and Payment System

> **Capstone Demonstration Notice:** This system is a single-school, fictional-data demonstration system developed for capstone audit and evaluation. It is not approved for real financial operations, government-recognized tax receipting, or live student data.

---

## Overview

The **Online School Fees Monitoring and Payment System** is a Next.js application built for educational institutions. It provides role-based user portals (Administrator, Finance Staff, Parent, and Student) for tracking student fee assessments, processing over-the-counter payments, simulating online gateway transactions, generating digital payment acknowledgment receipts, and rendering financial audit reports.

---

## Demo Accounts & Access Credentials

| User Role             | Email Address         | Password       | Portal Permissions                                                                                         |
| --------------------- | --------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Administrator**     | `admin@demo.school`   | `DemoPass123!` | Full system access, institution settings, fee structures, user & student management, audit logs, reversals |
| **Finance Staff**     | `finance@demo.school` | `DemoPass123!` | Over-The-Counter payment recording, assessment generation, receipts, financial transactions & reports      |
| **Parent / Guardian** | `parent@demo.school`  | `DemoPass123!` | View linked children accounts, balances, payment history, download receipts, simulated online payments     |
| **Student**           | `student@demo.school` | `DemoPass123!` | Read-only view of own fee assessment, balance, and payment receipts                                        |

---

## Capstone Audit & Presentation Walkthrough Script

Follow this step-by-step presentation story to demonstrate the complete end-to-end workflow:

1. **Administrator Portal Setup:**
   - Sign in as `admin@demo.school`.
   - Navigate to **Institution Settings** (`/admin/settings`) to view school metadata and active school year (`SY 2024–2025`).
   - Navigate to **Student Directory** (`/admin/students`) and click **Add New Student** to register a student.
   - Navigate to **Fees Management** (`/admin/fees`) to view configured grade-level fee templates.

2. **Finance Staff Over-The-Counter Payment:**
   - Sign in as `finance@demo.school`.
   - Navigate to **Over-The-Counter Payment** (`/admin/payments/manual`).
   - Select student **Juan Dela Cruz Jr.**, select unpaid fee items (Tuition & Miscellaneous), and record a partial cash payment of **₱14,000.00**.
   - Confirm payment submission and view the generated **Official Payment Acknowledgment Receipt** (`/admin/transactions/OR-2024-000123`).
   - Click **Print Receipt** to download the `pdf-lib` generated PDF receipt.

3. **Parent Portal & Online Payment Simulation:**
   - Sign in as `parent@demo.school`.
   - View **Parent Dashboard** (`/parent/dashboard`) showing linked child **Juan Dela Cruz Jr.** and remaining balance.
   - Click **Make Payment** (`/parent/pay`) and select **GCash** or **Maya**.
   - Complete the simulated online payment checkout (`/parent/pay/mock-checkout`).
   - Observe that replaying or refreshing the payment callback triggers **server-side idempotency verification**, preventing duplicate payment creation.

4. **Student Portal Read-Only Access:**
   - Sign in as `student@demo.school`.
   - View **Student Dashboard** (`/student/dashboard`) and **Fee Statement** (`/student/account`), observing read-only permissions.

5. **Financial Reporting & Payment Reversal:**
   - Sign in as `admin@demo.school`.
   - View **Transactions Log** (`/admin/transactions`) and **Reports** (`/admin/reports`).
   - Click **Download CSV** (`/api/reports/csv`) to export financial collections data.
   - Select an invalid transaction and execute a **Payment Reversal**, observing that the original record remains preserved, a compensating reversal entry is posted, the receipt is voided, and balance is restored.

---

## 20-Screen Scaffold Baseline

Access any of the 20 reference views directly via the master navigation hub (`/`) or quick-jump toolbar:

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

## Local Setup & Database Commands

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

4. **Seed or Reset Demo Database:**

   ```bash
   pnpm db:seed   # Seed fictional demo accounts & fee structures
   pnpm db:reset  # Reset database to clean initial demo state
   ```

5. **Start Development Server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Vercel & Neon Database Deployment

1. **Neon PostgreSQL Database:**
   - Create a serverless PostgreSQL database project at [Neon](https://neon.tech).
   - Copy your connection string into `DATABASE_URL` in `.env.local` or Vercel Environment Variables.

2. **Vercel Project Deployment:**
   - Push your repository to GitHub.
   - Import the project into Vercel.
   - Configure Environment Variables:
     - `DATABASE_URL`
     - `BETTER_AUTH_SECRET` (generate a random 32-character string)
     - `BETTER_AUTH_URL` (e.g. `https://your-app.vercel.app`)
     - `NEXT_PUBLIC_ENABLE_DEMO_NAV` (`true` for evaluation, `false` for clean mode)
     - `ENABLE_STUDENT_PORTAL` (`true`)

---

## Configuration & Feature Flags

| Variable                      | Description                              | Default                             |
| ----------------------------- | ---------------------------------------- | ----------------------------------- |
| `DATABASE_URL`                | Neon PostgreSQL Connection String        | Optional for build; required for DB |
| `BETTER_AUTH_SECRET`          | Secret key for session encryption        | Random 32-char string               |
| `BETTER_AUTH_URL`             | Base URL for auth endpoints              | `http://localhost:3000`             |
| `NEXT_PUBLIC_ENABLE_DEMO_NAV` | Toggle developer 20-screen quick toolbar | `true`                              |
| `ENABLE_STUDENT_PORTAL`       | Toggle student portal access             | `true`                              |
| `EMAIL_FROM`                  | Sender address for notifications         | `noreply@schoolfees.example.com`    |

---

## Available Scripts

- `pnpm dev` — Start development server
- `pnpm build` — Build production bundle
- `pnpm start` — Start production server
- `pnpm lint` — Run ESLint checks (`eslint .`)
- `pnpm typecheck` — Run TypeScript typecheck (`tsc --noEmit`)
- `pnpm format` — Format code with Prettier
- `pnpm format:check` — Verify Prettier code style
- `pnpm test` — Run Vitest unit & component tests
- `pnpm test:e2e` — Run Playwright E2E smoke tests
- `pnpm db:check` — Verify database connection
- `pnpm db:seed` — Seed fictional demo accounts & data
- `pnpm db:reset` — Clear and reset demo database
