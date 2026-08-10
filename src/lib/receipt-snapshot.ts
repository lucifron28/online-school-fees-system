import { z } from 'zod';

const nonNegativeCentavos = z.number().int().nonnegative();

export const receiptSnapshotSchema = z
  .object({
    version: z.literal(1),
    issuedAt: z.string().datetime({ offset: true }),
    receiptNumber: z.string().min(1),
    verificationIdentifier: z.string().min(1),
    institution: z.object({
      name: z.string(),
      address: z.string(),
      email: z.string(),
      phone: z.string(),
      timezone: z.string().min(1),
    }),
    student: z.object({
      studentNumber: z.string(),
      name: z.string(),
      gradeAndSection: z.string(),
    }),
    payment: z.object({
      amountCentavos: nonNegativeCentavos,
      paymentMethod: z.string(),
      referenceNumber: z.string().nullable(),
      balanceAfterPaymentCentavos: nonNegativeCentavos,
    }),
    processor: z.object({ name: z.string() }),
    allocations: z.array(
      z.object({
        targetType: z.enum(['ASSESSMENT_ITEM', 'DEBIT_ADJUSTMENT']),
        name: z.string(),
        amountCentavos: nonNegativeCentavos,
      })
    ),
  })
  .superRefine((snapshot, context) => {
    const allocated = snapshot.allocations.reduce(
      (total, allocation) => total + allocation.amountCentavos,
      0
    );
    if (allocated !== snapshot.payment.amountCentavos) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allocations'],
        message: 'Receipt allocations must equal the payment amount.',
      });
    }
  });

export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>;

export function getReceiptProcessorName(paymentMethod: string, staffName?: string | null): string {
  return paymentMethod === 'MOCK_ONLINE'
    ? 'Mock online payment system'
    : (staffName ?? 'Finance staff');
}

/** Returns null for pre-snapshot/invalid legacy data so history remains readable. */
export function parseReceiptSnapshot(value: unknown): ReceiptSnapshot | null {
  const parsed = receiptSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
