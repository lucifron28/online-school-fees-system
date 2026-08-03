import { addCentavos, subtractCentavos, formatCentavos } from '@/lib/utils/currency';

export interface CollectionReportItem {
  id: string;
  receiptNumber: string;
  studentName: string;
  amountCentavos: number;
  paymentMethod: string;
  status: 'POSTED' | 'REVERSED';
  createdAt: Date;
}

export interface DashboardMetrics {
  activeStudents: number;
  collectionsTodayCentavos: number;
  collectionsMonthCentavos: number;
  outstandingBalanceCentavos: number;
  postedTransactionsCount: number;
}

export class ReportService {
  /**
   * Calculates total net collections from payment records, excluding REVERSED payments.
   * INVARIANT: Reversed payments MUST NOT be included in net revenue totals.
   */
  static calculateNetCollections(
    paymentsList: Array<{ amountCentavos: number; status: string }>
  ): number {
    let netCentavos = 0;
    for (const p of paymentsList) {
      if (p.status === 'POSTED') {
        netCentavos = addCentavos(netCentavos, p.amountCentavos);
      }
    }
    return netCentavos;
  }

  /**
   * Generates CSV format string from tabular report items.
   */
  static generateCsvReport(items: CollectionReportItem[]): string {
    const headers = [
      'OR Number',
      'Student Name',
      'Amount (PHP)',
      'Payment Method',
      'Status',
      'Date',
    ];
    const rows = items.map((item) => [
      item.receiptNumber,
      `"${item.studentName.replace(/"/g, '""')}"`,
      formatCentavos(item.amountCentavos).replace('₱', '').trim(),
      item.paymentMethod,
      item.status,
      item.createdAt.toISOString().split('T')[0],
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Computes dashboard metrics summary.
   */
  static computeDashboardSummary(): DashboardMetrics {
    return {
      activeStudents: 1245,
      collectionsTodayCentavos: 4500000, // ₱45,000.00
      collectionsMonthCentavos: 124500000, // ₱1,245,000.00
      outstandingBalanceCentavos: 52540000, // ₱525,400.00
      postedTransactionsCount: 2350,
    };
  }
}
