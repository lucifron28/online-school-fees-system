import Link from 'next/link';
import {
  CheckCircle2,
  GraduationCap,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';

type LoginPortal = 'admin' | 'parent' | 'student';

type PortalConfig = {
  label: string;
  title: string;
  description: string;
  defaultEmail: string;
  buttonLabel: string;
  icon: typeof Shield;
  accentClass: string;
  linkClass: string;
  focusClass: string;
  panelTitle: string;
  panelDescription: string;
  panelPoints: string[];
};

const portalConfig: Record<LoginPortal, PortalConfig> = {
  admin: {
    label: 'Administrator portal',
    title: 'Manage school finance with confidence.',
    description: 'Sign in to manage student records, assessments, payments, and reports.',
    defaultEmail: 'admin@demo.school',
    buttonLabel: 'Sign in as administrator',
    icon: Shield,
    accentClass: 'bg-blue-600 hover:bg-blue-700',
    linkClass: 'text-blue-700 dark:text-blue-300',
    focusClass: 'dark:focus-visible:ring-blue-400',
    panelTitle: 'Make every collection easier to verify.',
    panelDescription:
      'Keep balances, assessments, and payment activity connected in one operational workspace.',
    panelPoints: ['Role-based access', 'Current student records', 'Reconciliation-ready reports'],
  },
  parent: {
    label: 'Parent and guardian portal',
    title: 'Know what is due before you pay.',
    description: 'Sign in to view linked children, fee assessments, payments, and receipts.',
    defaultEmail: 'parent@demo.school',
    buttonLabel: 'Sign in as parent or guardian',
    icon: Users,
    accentClass: 'bg-teal-600 hover:bg-teal-700',
    linkClass: 'text-teal-700 dark:text-teal-300',
    focusClass: 'dark:focus-visible:ring-teal-400',
    panelTitle: 'See the full picture of each child’s account.',
    panelDescription:
      'Review outstanding balances, completed payments, and receipts without hunting through messages.',
    panelPoints: ['Linked children in one view', 'Itemized balances', 'Receipts you can revisit'],
  },
  student: {
    label: 'Student portal',
    title: 'See your school account at a glance.',
    description: 'Sign in to review your assessment, balance, payment history, and receipts.',
    defaultEmail: 'student@demo.school',
    buttonLabel: 'Sign in as student',
    icon: GraduationCap,
    accentClass: 'bg-sky-600 hover:bg-sky-700',
    linkClass: 'text-sky-700 dark:text-sky-300',
    focusClass: 'dark:focus-visible:ring-sky-400',
    panelTitle: 'A straightforward view of your finance record.',
    panelDescription:
      'Check your current balance and payment history in a space designed for quick answers.',
    panelPoints: ['Personal account summary', 'Assessment details', 'Payment history and receipts'],
  },
};

const portalSwitches: Array<{ portal: LoginPortal; label: string; icon: typeof Shield }> = [
  { portal: 'admin', label: 'Administrator', icon: Shield },
  { portal: 'parent', label: 'Parent or guardian', icon: Users },
  { portal: 'student', label: 'Student', icon: GraduationCap },
];

function PortalVisual({ config }: { config: PortalConfig }) {
  const Icon = config.icon;

  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10" aria-hidden="true" />
      <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-teal-500/10" aria-hidden="true" />

      <div className="relative max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Secure school finance workspace
        </div>
        <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-8 max-w-lg text-3xl font-semibold tracking-tight xl:text-4xl">{config.panelTitle}</h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">{config.panelDescription}</p>
        <ul className="mt-8 space-y-4 text-sm text-slate-200">
          {config.panelPoints.map((point) => (
            <li key={point} className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-12 border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">
        Access is limited to your assigned school portal and account role.
      </p>
    </aside>
  );
}

export function PortalLoginPage({ portal }: { portal: LoginPortal }) {
  const config = portalConfig[portal];
  const Icon = config.icon;

  return (
    <div className="grid min-h-[calc(100dvh-8rem)] bg-background lg:grid-cols-2">
      <section className="flex items-center border-b border-border px-5 py-10 sm:px-8 lg:border-b-0 lg:border-r lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Back to portal selection
          </Link>

          <div className="mt-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{config.label}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{config.title}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{config.description}</p>
            </div>
          </div>

          <LoginForm
            portal={portal}
            defaultEmail={config.defaultEmail}
            buttonLabel={config.buttonLabel}
            accentClass={config.accentClass}
            linkClass={config.linkClass}
            focusClass={config.focusClass}
          />

          <div className="mt-8 border-t border-border pt-6">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Use a different portal</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {portalSwitches
                .filter((item) => item.portal !== portal)
                .map((item) => {
                  const SwitchIcon = item.icon;
                  return (
                    <Link
                      key={item.portal}
                      href={`/login/${item.portal}`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <SwitchIcon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      </section>

      <PortalVisual config={config} />
    </div>
  );
}
