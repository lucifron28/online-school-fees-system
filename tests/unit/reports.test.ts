import { describe, expect, it } from 'vitest';
import {
  getManilaDateString,
  parseManilaDateStart,
  resolveReportDateRange,
  type CollectionReportItem,
} from '@/lib/reports';
import { ReportService, protectSpreadsheetFormula } from '@/server/services/report.service';

function collectionItem(overrides: Partial<CollectionReportItem> = {}): CollectionReportItem {
  return {
    id: 'payment-1',
    receiptNumber: 'OSFS-2026-000123',
    studentId: 'student-1',
    studentNumber: 'STU-001',
    studentName: 'Juan Dela Cruz',
    gradeLevelName: 'Grade 10',
    sectionName: 'A',
    amountCentavos: 1400000,
    paymentMethod: 'CASH',
    referenceNumber: null,
    status: 'POSTED',
    createdAt: new Date('2026-08-08T04:00:00.000Z'),
    reconciliationStatus: 'RECONCILED',
    note: 'Payment, allocation, and receipt are present.',
    ...overrides,
  };
}

describe('Financial Reports & Reconciliation Logic', () => {
  it('excludes REVERSED payments from net collection totals', () => {
    const payments = [
      { amountCentavos: 1000000, status: 'POSTED' },
      { amountCentavos: 500000, status: 'POSTED' },
      { amountCentavos: 2000000, status: 'REVERSED' },
    ];

    expect(ReportService.calculateNetCollections(payments)).toBe(1500000);
  });

  it('generates CSV rows with escaped fields and formula protection', () => {
    const csv = ReportService.generateCsvReport([
      collectionItem({ studentName: '=HYPERLINK("https://attacker.example")' }),
    ]);

    expect(csv).toContain('"Payment ID"');
    expect(csv).toContain('\'=HYPERLINK(""https://attacker.example"")');
    expect(protectSpreadsheetFormula('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(protectSpreadsheetFormula('Juan Dela Cruz')).toBe('Juan Dela Cruz');
  });

  it('resolves report ranges using Asia/Manila calendar boundaries', () => {
    const now = new Date('2026-08-08T16:30:00.000Z');
    const range = resolveReportDateRange({}, now);

    expect(getManilaDateString(now)).toBe('2026-08-09');
    expect(range.from).toBe('2026-08-01');
    expect(range.to).toBe('2026-08-09');
    expect(range.start).toEqual(parseManilaDateStart('2026-08-01'));
    expect(range.end).toEqual(parseManilaDateStart('2026-08-10'));
  });
});
