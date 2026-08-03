import { describe, it, expect } from 'vitest';
import { ReportService, CollectionReportItem } from '@/server/services/report.service';

describe('Financial Reports & Dashboard Metrics Logic', () => {
  it('excludes REVERSED payments from net collection totals', () => {
    const payments = [
      { amountCentavos: 1000000, status: 'POSTED' }, // ₱10,000.00
      { amountCentavos: 500000, status: 'POSTED' }, // ₱5,000.00
      { amountCentavos: 2000000, status: 'REVERSED' }, // ₱20,000.00 (REVERSED)
    ];

    const net = ReportService.calculateNetCollections(payments);
    expect(net).toBe(1500000); // Only ₱15,000.00 posted
  });

  it('generates valid CSV format string from report items', () => {
    const items: CollectionReportItem[] = [
      {
        id: '1',
        receiptNumber: 'OSFS-2026-000123',
        studentName: 'Juan Dela Cruz',
        amountCentavos: 1400000,
        paymentMethod: 'GCash',
        status: 'POSTED',
        createdAt: new Date('2024-05-30'),
      },
    ];

    const csv = ReportService.generateCsvReport(items);
    expect(csv).toContain('OR Number,Student Name,Amount (PHP),Payment Method,Status,Date');
    expect(csv).toContain('OSFS-2026-000123');
    expect(csv).toContain('Juan Dela Cruz');
  });

  it('returns valid dashboard summary metrics', () => {
    const metrics = ReportService.computeDashboardSummary();
    expect(metrics.activeStudents).toBe(1245);
    expect(metrics.collectionsMonthCentavos).toBe(124500000);
    expect(metrics.postedTransactionsCount).toBe(2350);
  });
});
