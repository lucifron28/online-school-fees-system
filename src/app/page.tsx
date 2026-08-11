import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';

type WorkspaceLink = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const portalLinks = [
  {
    title: 'Administrator and finance',
    description: 'Manage students, assessments, payments, reports, and access.',
    href: '/login/admin',
    icon: Shield,
    className: 'lg:col-span-6',
    tone: 'border-blue-200 bg-blue-50/70 hover:border-blue-400 dark:border-blue-900/70 dark:bg-blue-950/30',
    iconTone: 'bg-blue-600 text-white',
  },
  {
    title: 'Parent or guardian',
    description: 'View linked children, balances, payments, and receipts.',
    href: '/login/parent',
    icon: Users,
    className: 'lg:col-span-3',
    tone: 'border-teal-200 bg-teal-50/70 hover:border-teal-400 dark:border-teal-900/70 dark:bg-teal-950/30',
    iconTone: 'bg-teal-600 text-white',
  },
  {
    title: 'Student',
    description: 'Review your account, balance, payment history, and receipts.',
    href: '/login/student',
    icon: GraduationCap,
    className: 'lg:col-span-3',
    tone: 'border-sky-200 bg-sky-50/70 hover:border-sky-400 dark:border-sky-900/70 dark:bg-sky-950/30',
    iconTone: 'bg-sky-600 text-white',
  },
];

const workspaceGroups: Array<{
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  links: WorkspaceLink[];
}> = [
  {
    title: 'Admin and finance workspace',
    description: 'Operational tools for the school finance team.',
    icon: Shield,
    className: 'lg:col-span-7',
    links: [
      {
        title: 'Dashboard',
        description: 'Collections, balances, and recent transactions',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Student directory',
        description: 'Search records and manage student accounts',
        href: '/admin/students',
        icon: Users,
      },
      {
        title: 'Fees management',
        description: 'Maintain fee structures and applicability rules',
        href: '/admin/fees',
        icon: CreditCard,
      },
      {
        title: 'Record a payment',
        description: 'Post an over-the-counter cashier payment',
        href: '/admin/payments/manual',
        icon: Wallet,
      },
      {
        title: 'Transactions',
        description: 'Review payment and reversal activity',
        href: '/admin/transactions',
        icon: Receipt,
      },
      {
        title: 'Reports',
        description: 'Export financial reports and reconciliations',
        href: '/admin/reports',
        icon: FileText,
      },
      {
        title: 'Student profile',
        description: 'Open a student record from the directory',
        href: '/admin/students',
        icon: Users,
      },
      {
        title: 'Transaction details',
        description: 'Open a transaction from the ledger',
        href: '/admin/transactions',
        icon: Receipt,
      },
    ],
  },
  {
    title: 'Parent workspace',
    description: 'Family account views and payment actions.',
    icon: Users,
    className: 'lg:col-span-5',
    links: [
      {
        title: 'Dashboard',
        description: 'Linked children and current balances',
        href: '/parent/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Child account details',
        description: 'Itemized fees and balance status',
        href: '/parent/dashboard',
        icon: Users,
      },
      {
        title: 'Make a payment',
        description: 'Choose an online payment method',
        href: '/parent/pay',
        icon: CreditCard,
      },
      {
        title: 'Payment history',
        description: 'Completed payments and receipts',
        href: '/parent/history',
        icon: Receipt,
      },
    ],
  },
  {
    title: 'Student workspace',
    description: 'Personal finance records and receipts.',
    icon: GraduationCap,
    className: 'lg:col-span-12',
    links: [
      {
        title: 'Dashboard',
        description: 'Balance overview and account shortcuts',
        href: '/student/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'My account',
        description: 'Detailed assessment and balance statement',
        href: '/student/account',
        icon: GraduationCap,
      },
      {
        title: 'Payment history',
        description: 'Personal payment transaction history',
        href: '/student/history',
        icon: Receipt,
      },
      {
        title: 'Payment receipt',
        description: 'Open a receipt from payment history',
        href: '/student/history',
        icon: Receipt,
      },
    ],
  },
];

function PortalLink({
  title,
  description,
  href,
  icon: Icon,
  className,
  tone,
  iconTone,
}: (typeof portalLinks)[number]) {
  return (
    <Link
      href={href}
      className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-5 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md ${tone} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ${iconTone}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <ArrowUpRight
          className="h-5 w-5 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="mt-8">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export default function HomeHubPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl dark:border dark:border-slate-800">
        <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />
              Clear records for every school account
            </div>
            <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Keep every fee, payment, and receipt in one clear record.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              A focused school finance portal for administrators, finance staff, parents, and
              students. Choose your portal to continue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login/admin"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]"
              >
                Open administrator portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="#workspace-map"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-100 transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]"
              >
                Explore workspace map
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Built for clarity
            </p>
            <ul className="mt-5 space-y-5 text-sm text-slate-300">
              <li className="flex gap-3">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                  aria-hidden="true"
                />
                <span>Role-based access for each type of account</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                  aria-hidden="true"
                />
                <span>Balances and assessments that are easy to verify</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                  aria-hidden="true"
                />
                <span>Receipts and transaction records in one place</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="portal-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Choose a portal
            </p>
            <h2
              id="portal-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
            >
              Start from the account you use.
            </h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          {portalLinks.map((portal) => (
            <PortalLink key={portal.title} {...portal} />
          ))}
        </div>
      </section>

      <section id="workspace-map" aria-labelledby="workspace-heading" className="scroll-mt-6">
        <div className="mb-5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Workspace map
          </p>
          <h2
            id="workspace-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
          >
            Explore the main views.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use these links to preview the available workflows before signing in with a configured
            account.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          {workspaceGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section
                key={group.title}
                className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${group.className}`}
              >
                <div className="flex items-start gap-3 border-b border-border pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GroupIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-foreground">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-border">
                  {group.links.map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={`${link.title}-${link.href}`}
                        href={link.href}
                        className="group flex min-h-14 items-center gap-3 py-3 transition-colors duration-150 first:pt-2 last:pb-2 hover:text-primary"
                      >
                        <LinkIcon
                          className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground group-hover:text-primary">
                            {link.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {link.description}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
