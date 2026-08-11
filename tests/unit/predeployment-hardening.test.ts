import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { getReceiptProcessorName } from '@/lib/receipt-snapshot';
import {
  generateReceiptPdf,
  SYSTEM_GENERATED_RECEIPT_DISCLAIMER,
  SYSTEM_GENERATED_RECEIPT_TITLE,
} from '@/lib/pdf/receipt-generator';
import { fitPdfText } from '@/lib/pdf/text';
import { generateStatementPdf } from '@/lib/pdf/statement-generator';
import type { StudentStatement } from '@/lib/reports';

function statementWithEntries(count: number): StudentStatement {
  return {
    student: {
      id: 'student-1',
      studentNumber: 'S-0001',
      name: 'Test Student',
      email: 'student@example.com',
      gradeLevelName: 'Grade 1',
      sectionName: 'A',
    },
    dateRange: { from: '2026-08-01', to: '2026-08-31' },
    openingBalanceCentavos: 100_000,
    entries: Array.from({ length: count }, (_, index) => ({
      id: `entry-${index}`,
      createdAt: new Date(Date.UTC(2026, 7, 1, 0, index)),
      entryType: 'ASSESSMENT',
      description:
        index === 0
          ? 'A long description that must be bounded so it cannot overlap the amount columns or the footer area.'
          : `Ledger entry ${index}`,
      debitCentavos: 100,
      creditCentavos: 0,
      balanceCentavos: 100_000 + (index + 1) * 100,
    })).reverse(),
    payments: [],
    closingBalanceCentavos: 100_000 + count * 100,
    institution: {
      name: 'Online School Fees Monitoring System',
      address: '123 Education Way, Manila',
      email: 'info@schoolfees.example.com',
      phone: '+63 2 8123-4567',
    },
  };
}

function receiptWithAllocations(count: number) {
  return {
    receiptNumber: 'OSFS-2026-000123',
    verificationIdentifier: 'VER-ABC123XYZ',
    paymentDate: 'May 30, 2024 10:30 AM',
    paymentMethod: 'CASH',
    studentNumber: 'S2026-0001',
    studentName: 'Juan Dela Cruz Jr.',
    gradeAndSection: 'Grade 10 - A',
    amountReceivedCentavos: count * 100,
    balanceAfterPaymentCentavos: 0,
    processedByName: 'Finance Staff',
    allocations: Array.from({ length: count }, (_, index) => ({
      name: `Fee allocation ${index} with a deliberately long label`,
      amountCentavos: 100,
    })),
    institution: {
      name: 'Online School Fees Monitoring System',
      address: '123 Education Way, Manila',
      email: 'info@schoolfees.example.com',
      phone: '+63 2 8123-4567',
    },
  };
}

describe('final pre-deployment hardening', () => {
  it('uses system-generated receipt wording with a tax-receipt disclaimer', () => {
    expect(SYSTEM_GENERATED_RECEIPT_TITLE).toBe('System-Generated Payment Receipt');
    expect(SYSTEM_GENERATED_RECEIPT_DISCLAIMER).toContain('It is not an official tax receipt.');
  });

  it.each([
    [0, 1],
    [1, 1],
    [24, 1],
    [25, 2],
    [60, 2],
    [61, 3],
  ])('renders every statement entry across pages for %i entries', async (count, expectedPages) => {
    const pdf = await generateStatementPdf(statementWithEntries(count));
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(expectedPages);
  });

  it('bounds long PDF text before drawing it into a table column', async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const fitted = fitPdfText(
      'A description with enough content to require truncation',
      font,
      7,
      90
    );
    expect(fitted).toMatch(/\.\.\.$/);
    expect(font.widthOfTextAtSize(fitted, 7)).toBeLessThanOrEqual(90);
  });

  it('continues long receipt allocation tables instead of drawing below the footer', async () => {
    const pdf = await generateReceiptPdf(receiptWithAllocations(60));
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(3);
  });

  it('labels receipt processors according to payment origin', () => {
    expect(getReceiptProcessorName('CASH', 'Maria Finance')).toBe('Maria Finance');
    expect(getReceiptProcessorName('BANK_DEPOSIT', 'Maria Finance')).toBe('Maria Finance');
    expect(getReceiptProcessorName('MOCK_ONLINE', 'Maria Finance')).toBe(
      'Mock online payment system'
    );
    expect(getReceiptProcessorName('MOCK_ONLINE', null)).toBe('Mock online payment system');
  });
});
