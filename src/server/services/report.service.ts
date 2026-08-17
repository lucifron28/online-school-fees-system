import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { addCentavos, formatCentavos, subtractCentavos } from '@/lib/utils/currency';
import {
  addManilaMonths,
  formatReportDate,
  getManilaDateString,
  resolveReportDateRange,
  type CollectionBreakdown,
  type CollectionReport,
  type CollectionReportItem,
  type CollectionReportPage,
  type DashboardMetrics,
  type OutstandingBalanceItem,
  type OutstandingBalanceReportPage,
  type ReportDateRange,
  type ReportDateRangeInput,
  type ReportKind,
  type ReversalReportPage,
  type ReversalReportItem,
  type StatementEntry,
  type StudentStatement,
  REPORT_TIME_ZONE,
} from '@/lib/reports';
import { calculateBalanceFromEntries } from './assessment.service';
import { getDeadlineSummary } from './deadline.service';
import { NotFoundError } from '@/server/errors';

export { type CollectionReportItem, type DashboardMetrics } from '@/lib/reports';

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function addToBreakdown(
  map: Map<string, CollectionBreakdown>,
  key: string,
  label: string,
  amountCentavos: number
) {
  const current = map.get(key) ?? { key, label, amountCentavos: 0, transactionCount: 0 };
  current.amountCentavos = addCentavos(current.amountCentavos, amountCentavos);
  current.transactionCount += 1;
  map.set(key, current);
}

function getDateRangeConditions(
  range: ReportDateRange,
  column: SQLWrapper = schema.payments.createdAt
) {
  return [gte(column, range.start), lt(column, range.end)];
}

type CollectionRow = {
  id: string;
  receiptId: string | null;
  receiptNumber: string | null;
  studentId: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: Date;
  allocationTotal: unknown;
};

async function selectCollectionRows(
  db: DatabaseInstance,
  options: {
    range?: ReportDateRange;
    studentId?: string;
    search?: string;
    pagination?: { limit: number; offset: number };
  } = {}
): Promise<CollectionRow[]> {
  const conditions = buildCollectionConditions(options);

  const query = db
    .select({
      id: schema.payments.id,
      receiptId: schema.receipts.id,
      receiptNumber: schema.receipts.receiptNumber,
      studentId: schema.payments.studentId,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      gradeLevelName: schema.gradeLevels.name,
      sectionName: schema.sections.name,
      amountCentavos: schema.payments.amountCentavos,
      paymentMethod: schema.payments.paymentMethod,
      referenceNumber: schema.payments.referenceNumber,
      status: schema.payments.status,
      createdAt: schema.payments.createdAt,
      allocationTotal: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCentavos}), 0)`,
    })
    .from(schema.payments)
    .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
    .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
    .leftJoin(
      schema.paymentAllocations,
      eq(schema.paymentAllocations.paymentId, schema.payments.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(
      schema.payments.id,
      schema.receipts.id,
      schema.receipts.receiptNumber,
      schema.students.id,
      schema.students.studentNumber,
      schema.students.firstName,
      schema.students.lastName,
      schema.gradeLevels.name,
      schema.sections.name,
      schema.payments.amountCentavos,
      schema.payments.paymentMethod,
      schema.payments.referenceNumber,
      schema.payments.status,
      schema.payments.createdAt
    )
    .orderBy(desc(schema.payments.createdAt), asc(schema.payments.id));

  return options.pagination
    ? query.limit(options.pagination.limit).offset(options.pagination.offset)
    : query;
}

function buildCollectionConditions(options: {
  range?: ReportDateRange;
  studentId?: string;
  search?: string;
}) {
  const conditions: SQL[] = [];
  if (options.range) conditions.push(...getDateRangeConditions(options.range));
  if (options.studentId) conditions.push(eq(schema.payments.studentId, options.studentId));
  if (options.search) {
    const pattern = `%${options.search}%`;
    conditions.push(
      or(
        ilike(schema.students.studentNumber, pattern),
        ilike(schema.students.firstName, pattern),
        ilike(schema.students.lastName, pattern),
        ilike(schema.receipts.receiptNumber, pattern),
        ilike(schema.payments.referenceNumber, pattern)
      ) as SQL
    );
  }
  return conditions;
}

function toCollectionItem(row: CollectionRow): CollectionReportItem {
  const allocationTotal = toNumber(row.allocationTotal);
  if (row.status === 'REVERSED') {
    return {
      id: row.id,
      receiptNumber: row.receiptNumber,
      studentId: row.studentId,
      studentNumber: row.studentNumber,
      studentName: `${row.studentFirstName} ${row.studentLastName}`,
      gradeLevelName: row.gradeLevelName,
      sectionName: row.sectionName,
      amountCentavos: row.amountCentavos,
      paymentMethod: row.paymentMethod,
      referenceNumber: row.referenceNumber,
      createdAt: row.createdAt,
      status: 'REVERSED',
      reconciliationStatus: 'REVERSED',
      note: 'Payment reversed and excluded from net collections.',
    };
  }

  const reconciled = Boolean(row.receiptId) && allocationTotal === row.amountCentavos;
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    studentId: row.studentId,
    studentNumber: row.studentNumber,
    studentName: `${row.studentFirstName} ${row.studentLastName}`,
    gradeLevelName: row.gradeLevelName,
    sectionName: row.sectionName,
    amountCentavos: row.amountCentavos,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    createdAt: row.createdAt,
    reconciliationStatus: reconciled ? 'RECONCILED' : 'REVIEW',
    note: reconciled
      ? 'Payment, allocation, and receipt are present.'
      : !row.receiptId
        ? 'Payment receipt is missing.'
        : `Allocation total (${allocationTotal}) does not match payment amount (${row.amountCentavos}).`,
  };
}

function emptyTotals() {
  return {
    grossCollectionsCentavos: 0,
    netCollectionsCentavos: 0,
    reversedCentavos: 0,
    postedTransactionCount: 0,
    reversedTransactionCount: 0,
  };
}

function getCollectionTotals(items: CollectionReportItem[]) {
  const totals = emptyTotals();
  const byPaymentMethod = new Map<string, CollectionBreakdown>();
  const byGradeLevel = new Map<string, CollectionBreakdown>();

  for (const item of items) {
    if (item.status === 'POSTED') {
      totals.grossCollectionsCentavos = addCentavos(
        totals.grossCollectionsCentavos,
        item.amountCentavos
      );
      totals.netCollectionsCentavos = addCentavos(
        totals.netCollectionsCentavos,
        item.amountCentavos
      );
      totals.postedTransactionCount += 1;
      addToBreakdown(byPaymentMethod, item.paymentMethod, item.paymentMethod, item.amountCentavos);
      const gradeKey = item.gradeLevelName ?? 'UNASSIGNED';
      addToBreakdown(
        byGradeLevel,
        gradeKey,
        item.gradeLevelName ?? 'Unassigned',
        item.amountCentavos
      );
    } else if (item.status === 'REVERSED') {
      totals.grossCollectionsCentavos = addCentavos(
        totals.grossCollectionsCentavos,
        item.amountCentavos
      );
      totals.reversedCentavos = addCentavos(totals.reversedCentavos, item.amountCentavos);
      totals.reversedTransactionCount += 1;
    }
  }

  return {
    totals,
    byPaymentMethod: [...byPaymentMethod.values()].sort(
      (a, b) => b.amountCentavos - a.amountCentavos
    ),
    byGradeLevel: [...byGradeLevel.values()].sort((a, b) => b.amountCentavos - a.amountCentavos),
  };
}

async function selectCollectionSummary(db: DatabaseInstance, range: ReportDateRange) {
  const where = and(...buildCollectionConditions({ range }));
  const [statusRows, paymentMethodRows, gradeLevelRows] = await Promise.all([
    db
      .select({
        status: schema.payments.status,
        amountCentavos: sql<number>`coalesce(sum(${schema.payments.amountCentavos}), 0)`,
        transactionCount: count(),
      })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .where(where)
      .groupBy(schema.payments.status),
    db
      .select({
        paymentMethod: schema.payments.paymentMethod,
        amountCentavos: sql<number>`coalesce(sum(${schema.payments.amountCentavos}), 0)`,
        transactionCount: count(),
      })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .where(and(where, eq(schema.payments.status, 'POSTED')))
      .groupBy(schema.payments.paymentMethod),
    db
      .select({
        gradeLevelName: schema.gradeLevels.name,
        amountCentavos: sql<number>`coalesce(sum(${schema.payments.amountCentavos}), 0)`,
        transactionCount: count(),
      })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
      .where(and(where, eq(schema.payments.status, 'POSTED')))
      .groupBy(schema.gradeLevels.name),
  ]);

  const totals = emptyTotals();
  for (const row of statusRows) {
    const amountCentavos = toNumber(row.amountCentavos);
    const transactionCount = toNumber(row.transactionCount);
    if (row.status === 'POSTED') {
      totals.grossCollectionsCentavos = addCentavos(
        totals.grossCollectionsCentavos,
        amountCentavos
      );
      totals.netCollectionsCentavos = addCentavos(totals.netCollectionsCentavos, amountCentavos);
      totals.postedTransactionCount += transactionCount;
    } else if (row.status === 'REVERSED') {
      totals.grossCollectionsCentavos = addCentavos(
        totals.grossCollectionsCentavos,
        amountCentavos
      );
      totals.reversedCentavos = addCentavos(totals.reversedCentavos, amountCentavos);
      totals.reversedTransactionCount += transactionCount;
    }
  }

  return {
    totals,
    byPaymentMethod: paymentMethodRows
      .map((row) => ({
        key: row.paymentMethod,
        label: row.paymentMethod,
        amountCentavos: toNumber(row.amountCentavos),
        transactionCount: toNumber(row.transactionCount),
      }))
      .sort((a, b) => b.amountCentavos - a.amountCentavos),
    byGradeLevel: gradeLevelRows
      .map((row) => ({
        key: row.gradeLevelName ?? 'UNASSIGNED',
        label: row.gradeLevelName ?? 'Unassigned',
        amountCentavos: toNumber(row.amountCentavos),
        transactionCount: toNumber(row.transactionCount),
      }))
      .sort((a, b) => b.amountCentavos - a.amountCentavos),
  };
}

function csvSafeCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  const safeText = /^[\t\r\n=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function createOutstandingLedgerTotals(db: DatabaseInstance) {
  return db
    .select({
      studentId: schema.ledgerEntries.studentId,
      debitCentavos: sql<number>`coalesce(sum(${schema.ledgerEntries.debitCentavos}), 0)`.as(
        'debit_centavos'
      ),
      creditCentavos: sql<number>`coalesce(sum(${schema.ledgerEntries.creditCentavos}), 0)`.as(
        'credit_centavos'
      ),
    })
    .from(schema.ledgerEntries)
    .groupBy(schema.ledgerEntries.studentId)
    .as('outstanding_ledger_totals');
}

function createOutstandingAssessmentCounts(db: DatabaseInstance) {
  return db
    .select({
      studentId: schema.studentAssessments.studentId,
      postedAssessmentCount: sql<number>`count(*)`.as('posted_assessment_count'),
    })
    .from(schema.studentAssessments)
    .where(eq(schema.studentAssessments.status, 'POSTED'))
    .groupBy(schema.studentAssessments.studentId)
    .as('outstanding_assessment_counts');
}

function outstandingBalanceExpression(
  ledgerTotals: ReturnType<typeof createOutstandingLedgerTotals>
) {
  return sql<number>`greatest(coalesce(${ledgerTotals.debitCentavos}, 0) - coalesce(${ledgerTotals.creditCentavos}, 0), 0)`;
}

async function selectOutstandingBalanceRows(
  db: DatabaseInstance,
  pagination?: { limit: number; offset: number }
) {
  const ledgerTotals = createOutstandingLedgerTotals(db);
  const assessmentCounts = createOutstandingAssessmentCounts(db);
  const outstandingBalance = outstandingBalanceExpression(ledgerTotals);
  const query = db
    .select({
      studentId: schema.students.id,
      studentNumber: schema.students.studentNumber,
      firstName: schema.students.firstName,
      lastName: schema.students.lastName,
      status: schema.students.status,
      gradeLevelName: schema.gradeLevels.name,
      sectionName: schema.sections.name,
      outstandingBalanceCentavos: outstandingBalance,
      postedAssessmentCount: sql<number>`coalesce(${assessmentCounts.postedAssessmentCount}, 0)`,
    })
    .from(schema.students)
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
    .leftJoin(ledgerTotals, eq(ledgerTotals.studentId, schema.students.id))
    .leftJoin(assessmentCounts, eq(assessmentCounts.studentId, schema.students.id))
    .where(sql`${outstandingBalance} > 0`)
    .orderBy(
      asc(schema.students.lastName),
      asc(schema.students.firstName),
      asc(schema.students.id)
    );

  return pagination ? query.limit(pagination.limit).offset(pagination.offset) : query;
}

async function selectOutstandingBalanceSummary(db: DatabaseInstance) {
  const ledgerTotals = createOutstandingLedgerTotals(db);
  const outstandingBalance = outstandingBalanceExpression(ledgerTotals);
  const rows = await db
    .select({
      total: count(),
      totalOutstandingBalanceCentavos: sql<number>`coalesce(sum(${outstandingBalance}), 0)`,
    })
    .from(schema.students)
    .leftJoin(ledgerTotals, eq(ledgerTotals.studentId, schema.students.id))
    .where(sql`${outstandingBalance} > 0`);
  return {
    total: Number(rows[0]?.total ?? 0),
    totalOutstandingBalanceCentavos: toNumber(rows[0]?.totalOutstandingBalanceCentavos),
  };
}

async function selectReversalRows(
  db: DatabaseInstance,
  dateRange: ReportDateRange,
  pagination?: { limit: number; offset: number }
) {
  const query = db
    .select({
      id: schema.paymentReversals.id,
      paymentId: schema.paymentReversals.paymentId,
      receiptNumber: schema.receipts.receiptNumber,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      gradeLevelName: schema.gradeLevels.name,
      amountCentavos: schema.payments.amountCentavos,
      paymentMethod: schema.payments.paymentMethod,
      reason: schema.paymentReversals.reason,
      reversedByName: schema.users.name,
      reversedAt: schema.paymentReversals.createdAt,
    })
    .from(schema.paymentReversals)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentReversals.paymentId))
    .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.receipts, eq(schema.receipts.id, schema.paymentReversals.receiptId))
    .leftJoin(schema.users, eq(schema.users.id, schema.paymentReversals.reversedByUserId))
    .where(and(...getDateRangeConditions(dateRange, schema.paymentReversals.createdAt)))
    .orderBy(desc(schema.paymentReversals.createdAt), asc(schema.paymentReversals.id));

  return pagination ? query.limit(pagination.limit).offset(pagination.offset) : query;
}

function toReversalReportItem(
  row: Awaited<ReturnType<typeof selectReversalRows>>[number]
): ReversalReportItem {
  return {
    id: row.id,
    paymentId: row.paymentId,
    receiptNumber: row.receiptNumber,
    studentNumber: row.studentNumber,
    studentName: `${row.studentFirstName} ${row.studentLastName}`,
    gradeLevelName: row.gradeLevelName,
    amountCentavos: row.amountCentavos,
    paymentMethod: row.paymentMethod,
    reason: row.reason,
    reversedByName: row.reversedByName,
    reversedAt: row.reversedAt,
  };
}

export function protectSpreadsheetFormula(value: string): string {
  return /^[\t\r\n=+\-@]/.test(value) ? `'${value}` : value;
}

export class ReportService {
  /**
   * Calculates total net collections from payment records, excluding REVERSED payments.
   */
  static calculateNetCollections(
    paymentsList: Array<{ amountCentavos: number; status: string }>
  ): number {
    return paymentsList
      .filter((payment) => payment.status === 'POSTED')
      .reduce((total, payment) => addCentavos(total, payment.amountCentavos), 0);
  }

  static generateCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
    return [
      headers.map((header) => csvSafeCell(header)).join(','),
      ...rows.map((row) => row.map((value) => csvSafeCell(value)).join(',')),
    ].join('\n');
  }

  static generateCsvReport(items: CollectionReportItem[]): string {
    return ReportService.generateCsv(
      [
        'Payment ID',
        'Receipt Number',
        'Student Number',
        'Student Name',
        'Grade Level',
        'Amount (PHP)',
        'Payment Method',
        'Status',
        'Reconciliation',
        'Reconciliation Note',
        'Date',
      ],
      items.map((item) => [
        item.id,
        item.receiptNumber,
        item.studentNumber,
        item.studentName,
        item.gradeLevelName,
        formatCentavos(item.amountCentavos).replace('₱', '').trim(),
        item.paymentMethod,
        item.status,
        item.reconciliationStatus,
        item.note,
        formatReportDate(item.createdAt),
      ])
    );
  }

  static async getCollectionReport(
    input: ReportDateRangeInput = {},
    db: DatabaseInstance = getDb()
  ): Promise<CollectionReport> {
    const dateRange = resolveReportDateRange(input);
    const rows = await selectCollectionRows(db, { range: dateRange });
    const items = rows.map(toCollectionItem);
    const breakdowns = getCollectionTotals(items);
    return {
      dateRange,
      items,
      totals: breakdowns.totals,
      byPaymentMethod: breakdowns.byPaymentMethod,
      byGradeLevel: breakdowns.byGradeLevel,
    };
  }

  static async getCollectionReportPage(
    input: ReportDateRangeInput = {},
    pageInput = 1,
    pageSizeInput = 20,
    db: DatabaseInstance = getDb()
  ): Promise<CollectionReportPage> {
    const dateRange = resolveReportDateRange(input);
    const pageSize = Math.min(50, Math.max(1, Math.floor(pageSizeInput || 20)));
    const where = and(...buildCollectionConditions({ range: dateRange }));
    const totalRows = await db
      .select({ total: count() })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .where(where);
    const total = Number(totalRows[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.floor(pageInput || 1)));
    const [rows, summary] = await Promise.all([
      selectCollectionRows(db, {
        range: dateRange,
        pagination: { limit: pageSize, offset: (page - 1) * pageSize },
      }),
      selectCollectionSummary(db, dateRange),
    ]);

    return {
      dateRange,
      items: rows.map(toCollectionItem),
      totals: summary.totals,
      byPaymentMethod: summary.byPaymentMethod,
      byGradeLevel: summary.byGradeLevel,
      pagination: {
        page,
        pageSize,
        total,
        pageCount,
      },
    };
  }

  static async getOutstandingBalanceReport(
    db: DatabaseInstance = getDb()
  ): Promise<OutstandingBalanceItem[]> {
    const rows = await selectOutstandingBalanceRows(db);
    return rows.map((student) => ({
      studentId: student.studentId,
      studentNumber: student.studentNumber,
      studentName: `${student.firstName} ${student.lastName}`,
      status: student.status,
      gradeLevelName: student.gradeLevelName,
      sectionName: student.sectionName,
      outstandingBalanceCentavos: toNumber(student.outstandingBalanceCentavos),
      postedAssessmentCount: toNumber(student.postedAssessmentCount),
    }));
  }

  static async getOutstandingBalanceReportPage(
    pageInput = 1,
    pageSizeInput = 12,
    db: DatabaseInstance = getDb()
  ): Promise<OutstandingBalanceReportPage> {
    const pageSize = Math.min(50, Math.max(1, Math.floor(pageSizeInput || 12)));
    const summary = await selectOutstandingBalanceSummary(db);
    const pageCount = Math.max(1, Math.ceil(summary.total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.floor(pageInput || 1)));
    const rows = await selectOutstandingBalanceRows(db, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items: rows.map((student) => ({
        studentId: student.studentId,
        studentNumber: student.studentNumber,
        studentName: `${student.firstName} ${student.lastName}`,
        status: student.status,
        gradeLevelName: student.gradeLevelName,
        sectionName: student.sectionName,
        outstandingBalanceCentavos: toNumber(student.outstandingBalanceCentavos),
        postedAssessmentCount: toNumber(student.postedAssessmentCount),
      })),
      totals: {
        totalOutstandingBalanceCentavos: summary.totalOutstandingBalanceCentavos,
      },
      pagination: {
        page,
        pageSize,
        total: summary.total,
        pageCount,
      },
    };
  }

  static async getReversalReport(
    input: ReportDateRangeInput = {},
    db: DatabaseInstance = getDb()
  ): Promise<{ dateRange: Pick<ReportDateRange, 'from' | 'to'>; items: ReversalReportItem[] }> {
    const dateRange = resolveReportDateRange(input);
    const rows = await selectReversalRows(db, dateRange);

    return {
      dateRange,
      items: rows.map(toReversalReportItem),
    };
  }

  static async getReversalReportPage(
    input: ReportDateRangeInput = {},
    pageInput = 1,
    pageSizeInput = 12,
    db: DatabaseInstance = getDb()
  ): Promise<ReversalReportPage> {
    const dateRange = resolveReportDateRange(input);
    const pageSize = Math.min(50, Math.max(1, Math.floor(pageSizeInput || 12)));
    const totalRows = await db
      .select({ total: count() })
      .from(schema.paymentReversals)
      .where(and(...getDateRangeConditions(dateRange, schema.paymentReversals.createdAt)));
    const total = Number(totalRows[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.floor(pageInput || 1)));
    const rows = await selectReversalRows(db, dateRange, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      dateRange,
      items: rows.map(toReversalReportItem),
      pagination: {
        page,
        pageSize,
        total,
        pageCount,
      },
    };
  }

  static async getStudentStatement(
    studentId: string,
    input: ReportDateRangeInput = {},
    db: DatabaseInstance = getDb()
  ): Promise<StudentStatement> {
    const [students, entries, settings] = await Promise.all([
      db
        .select({
          id: schema.students.id,
          studentNumber: schema.students.studentNumber,
          firstName: schema.students.firstName,
          lastName: schema.students.lastName,
          email: schema.students.email,
          gradeLevelName: schema.gradeLevels.name,
          sectionName: schema.sections.name,
        })
        .from(schema.students)
        .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
        .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
        .where(eq(schema.students.id, studentId))
        .limit(1),
      db
        .select({
          id: schema.ledgerEntries.id,
          createdAt: schema.ledgerEntries.createdAt,
          entryType: schema.ledgerEntries.entryType,
          description: schema.ledgerEntries.description,
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
          balanceCentavos: schema.ledgerEntries.balanceCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, studentId))
        .orderBy(asc(schema.ledgerEntries.createdAt)),
      db.select().from(schema.schoolSettings).limit(1),
    ]);
    if (!students[0]) throw new NotFoundError('The student record does not exist.');

    const hasDateFilter = Boolean(input.from || input.to);
    const dateRange = hasDateFilter ? resolveReportDateRange(input) : undefined;
    const paymentRows = await selectCollectionRows(db, { studentId, range: dateRange });
    const allStatementEntries: StatementEntry[] = entries.map((entry) => ({
      ...entry,
      debitCentavos: Number(entry.debitCentavos),
      creditCentavos: Number(entry.creditCentavos),
      balanceCentavos: Number(entry.balanceCentavos),
    }));
    const openingBalanceCentavos = dateRange
      ? calculateBalanceFromEntries(
          allStatementEntries.filter((entry) => entry.createdAt < dateRange.start)
        )
      : null;
    const statementEntries = dateRange
      ? (() => {
          let runningBalance = openingBalanceCentavos ?? 0;
          return allStatementEntries
            .filter(
              (entry) => entry.createdAt >= dateRange.start && entry.createdAt < dateRange.end
            )
            .map((entry) => {
              runningBalance = addCentavos(
                runningBalance,
                subtractCentavos(entry.debitCentavos, entry.creditCentavos)
              );
              return { ...entry, balanceCentavos: runningBalance };
            });
        })()
      : allStatementEntries;
    const closingBalanceCentavos = dateRange
      ? (statementEntries.at(-1)?.balanceCentavos ?? openingBalanceCentavos ?? 0)
      : calculateBalanceFromEntries(statementEntries);
    const institution = settings[0];

    return {
      student: {
        id: students[0].id,
        studentNumber: students[0].studentNumber,
        name: `${students[0].firstName} ${students[0].lastName}`,
        email: students[0].email,
        gradeLevelName: students[0].gradeLevelName,
        sectionName: students[0].sectionName,
      },
      dateRange: dateRange ? { from: dateRange.from, to: dateRange.to } : null,
      openingBalanceCentavos,
      entries: statementEntries,
      payments: paymentRows.map(toCollectionItem),
      closingBalanceCentavos,
      institution: {
        name: institution?.schoolName ?? 'Online School Fees Monitoring & Payment System',
        address: institution?.address ?? 'Fictional capstone demonstration',
        email: institution?.email ?? 'info@schoolfees.example.com',
        phone: institution?.phone ?? '+63 (2) 8123-4567',
      },
    };
  }

  static async getDashboardSummary(
    db: DatabaseInstance = getDb(),
    now: Date = new Date()
  ): Promise<DashboardMetrics> {
    const today = getManilaDateString(now);
    const monthStart = `${today.slice(0, 8)}01`;
    const trendStart = addManilaMonths(monthStart, -5);
    const [
      todayReport,
      monthReport,
      trendReport,
      outstandingSummary,
      activeStudents,
      postedCount,
      recent,
      deadlineSummary,
      pendingProofs,
    ] = await Promise.all([
      ReportService.getCollectionReport({ from: today, to: today }, db),
      ReportService.getCollectionReport({ from: monthStart, to: today }, db),
      ReportService.getCollectionReport({ from: trendStart, to: today }, db),
      selectOutstandingBalanceSummary(db),
      db
        .select({ total: count() })
        .from(schema.students)
        .where(eq(schema.students.status, 'ACTIVE')),
      db
        .select({ total: count() })
        .from(schema.payments)
        .where(eq(schema.payments.status, 'POSTED')),
      selectCollectionRows(db, { pagination: { limit: 8, offset: 0 } }),
      getDeadlineSummary({ now, limit: 12 }, db),
      db
        .select({ total: count() })
        .from(schema.paymentSubmissions)
        .where(eq(schema.paymentSubmissions.status, 'PENDING_VERIFICATION')),
    ]);

    const trendByMonth = new Map<string, number>();
    for (const item of trendReport.items) {
      if (item.status !== 'POSTED') continue;
      const period = getManilaDateString(item.createdAt).slice(0, 7);
      trendByMonth.set(period, addCentavos(trendByMonth.get(period) ?? 0, item.amountCentavos));
    }
    const collectionTrend = Array.from({ length: 6 }, (_, index) => {
      const period = addManilaMonths(monthStart, index - 5).slice(0, 7);
      const labelDate = new Date(`${period}-01T00:00:00Z`);
      return {
        period,
        label: new Intl.DateTimeFormat('en-PH', {
          month: 'short',
          timeZone: REPORT_TIME_ZONE,
        }).format(labelDate),
        amountCentavos: trendByMonth.get(period) ?? 0,
      };
    });

    return {
      activeStudents: Number(activeStudents[0]?.total ?? 0),
      collectionsTodayCentavos: todayReport.totals.netCollectionsCentavos,
      collectionsMonthCentavos: monthReport.totals.netCollectionsCentavos,
      outstandingBalanceCentavos: outstandingSummary.totalOutstandingBalanceCentavos,
      postedTransactionsCount: Number(postedCount[0]?.total ?? 0),
      recentTransactions: recent.map(toCollectionItem),
      collectionTrend,
      paymentMethodBreakdown: monthReport.byPaymentMethod,
      dueSoonCount: deadlineSummary.dueSoonCount,
      overdueCount: deadlineSummary.overdueCount,
      pendingProofCount: Number(pendingProofs[0]?.total ?? 0),
      deadlineAssessments: [...deadlineSummary.dueSoon, ...deadlineSummary.overdue],
    };
  }

  static async getReportForCsv(
    kind: ReportKind,
    input: ReportDateRangeInput = {},
    db: DatabaseInstance = getDb()
  ) {
    if (kind === 'outstanding') {
      const rows = await ReportService.getOutstandingBalanceReport(db);
      return ReportService.generateCsv(
        [
          'Student Number',
          'Student Name',
          'Status',
          'Grade Level',
          'Section',
          'Outstanding Balance (PHP)',
          'Posted Assessments',
        ],
        rows.map((row) => [
          row.studentNumber,
          row.studentName,
          row.status,
          row.gradeLevelName,
          row.sectionName,
          formatCentavos(row.outstandingBalanceCentavos).replace('₱', '').trim(),
          row.postedAssessmentCount,
        ])
      );
    }
    if (kind === 'reversals') {
      const report = await ReportService.getReversalReport(input, db);
      return ReportService.generateCsv(
        [
          'Reversal ID',
          'Payment ID',
          'Receipt Number',
          'Student Number',
          'Student Name',
          'Amount (PHP)',
          'Payment Method',
          'Reason',
          'Reversed By',
          'Reversed At',
        ],
        report.items.map((row) => [
          row.id,
          row.paymentId,
          row.receiptNumber,
          row.studentNumber,
          row.studentName,
          formatCentavos(row.amountCentavos).replace('₱', '').trim(),
          row.paymentMethod,
          row.reason,
          row.reversedByName,
          formatReportDate(row.reversedAt),
        ])
      );
    }
    const report = await ReportService.getCollectionReport(input, db);
    if (kind === 'payment-method') {
      return ReportService.generateCsv(
        ['Payment Method', 'Net Collections (PHP)', 'Transaction Count'],
        report.byPaymentMethod.map((row) => [
          row.label,
          formatCentavos(row.amountCentavos).replace('₱', '').trim(),
          row.transactionCount,
        ])
      );
    }
    if (kind === 'grade-level') {
      return ReportService.generateCsv(
        ['Grade Level', 'Net Collections (PHP)', 'Transaction Count'],
        report.byGradeLevel.map((row) => [
          row.label,
          formatCentavos(row.amountCentavos).replace('₱', '').trim(),
          row.transactionCount,
        ])
      );
    }
    return ReportService.generateCsvReport(report.items);
  }
}
