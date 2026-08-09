import { describe, expect, it } from 'vitest';
import { calculateNetPaidFromEntries } from '@/server/services/ledger.service';
import { formatReceiptNumber, getReceiptYear } from '@/server/services/receipt.service';

describe('receipt numbering and net payment semantics', () => {
  it('formats a configured receipt prefix with a padded sequence', () => {
    expect(formatReceiptNumber('OSFS', 2026, 1)).toBe('OSFS-2026-000001');
    expect(formatReceiptNumber('CAMPUS', 2026, 42)).toBe('CAMPUS-2026-000042');
  });

  it('uses the configured timezone at the Manila year boundary', () => {
    expect(getReceiptYear(new Date('2026-12-31T15:59:59.000Z'), 'Asia/Manila')).toBe(2026);
    expect(getReceiptYear(new Date('2026-12-31T16:00:00.000Z'), 'Asia/Manila')).toBe(2027);
  });

  it('subtracts reversals from net paid without changing ledger balance rules', () => {
    expect(
      calculateNetPaidFromEntries([
        { entryType: 'PAYMENT', debitCentavos: 0, creditCentavos: 100_000 },
      ])
    ).toBe(100_000);
    expect(
      calculateNetPaidFromEntries([
        { entryType: 'PAYMENT', debitCentavos: 0, creditCentavos: 100_000 },
        { entryType: 'REVERSAL', debitCentavos: 100_000, creditCentavos: 0 },
      ])
    ).toBe(0);
    expect(
      calculateNetPaidFromEntries([
        { entryType: 'PAYMENT', debitCentavos: 0, creditCentavos: 100_000 },
        { entryType: 'PAYMENT', debitCentavos: 0, creditCentavos: 50_000 },
        { entryType: 'REVERSAL', debitCentavos: 100_000, creditCentavos: 0 },
      ])
    ).toBe(50_000);
  });
});
