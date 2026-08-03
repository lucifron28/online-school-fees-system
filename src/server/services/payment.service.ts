import { addCentavos, subtractCentavos, formatCentavos } from '@/lib/utils/currency';

export interface OtcPaymentInput {
  studentId: string;
  assessmentId: string;
  amountCentavos: number;
  paymentMethod: 'CASH' | 'BANK_DEPOSIT' | 'MOCK_ONLINE';
  referenceNumber?: string;
  processedByUserId: string;
  currentBalanceCentavos: number;
  assessmentItems: Array<{
    id: string;
    name: string;
    amountCentavos: number;
    paidCentavos: number;
  }>;
}

export interface ReversalInput {
  paymentId: string;
  receiptId: string;
  reason: string;
  reversedByUserId: string;
  isAlreadyReversed?: boolean;
}

/**
 * Sequential Allocation Algorithm (Oldest Item First Rule)
 * Allocates payment amount to assessment items in array order.
 */
export function allocatePaymentToItems(
  paymentAmountCentavos: number,
  items: Array<{ id: string; name: string; amountCentavos: number; paidCentavos: number }>
) {
  let remainingPayment = paymentAmountCentavos;
  const allocations: Array<{ assessmentItemId: string; name: string; amountCentavos: number }> = [];

  for (const item of items) {
    if (remainingPayment <= 0) break;

    const unpaidAmount = subtractCentavos(item.amountCentavos, item.paidCentavos);
    if (unpaidAmount <= 0) continue;

    const allocated = Math.min(remainingPayment, unpaidAmount);
    allocations.push({
      assessmentItemId: item.id,
      name: item.name,
      amountCentavos: allocated,
    });

    remainingPayment = subtractCentavos(remainingPayment, allocated);
  }

  return allocations;
}

/**
 * Payment, Receipt & Reversal Service Module
 */
export class PaymentService {
  /**
   * Process and post an OTC cash or bank deposit payment.
   */
  static async recordPayment(input: OtcPaymentInput) {
    const {
      amountCentavos,
      currentBalanceCentavos,
      assessmentItems,
      paymentMethod,
      processedByUserId,
    } = input;

    if (amountCentavos <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (amountCentavos > currentBalanceCentavos) {
      throw new Error(
        `Overpayment rejected. Payment amount (${formatCentavos(amountCentavos)}) exceeds current outstanding balance (${formatCentavos(currentBalanceCentavos)}).`
      );
    }

    const allocations = allocatePaymentToItems(amountCentavos, assessmentItems);
    const receiptNumber = `OSFS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const verificationIdentifier = `VER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newBalanceCentavos = subtractCentavos(currentBalanceCentavos, amountCentavos);

    return {
      paymentId: 'pay-simulated-001',
      receiptNumber,
      verificationIdentifier,
      amountCentavos,
      remainingBalanceCentavos: newBalanceCentavos,
      allocations,
      paymentMethod,
      processedByUserId,
      status: 'POSTED',
    };
  }

  /**
   * Reverses a posted payment through a compensating ledger entry.
   * Prevents double reversals.
   */
  static async reversePayment(input: ReversalInput) {
    const { paymentId, receiptId, reason, reversedByUserId, isAlreadyReversed } = input;

    if (isAlreadyReversed) {
      throw new Error(
        'Payment has already been reversed. Double reversals are strictly prohibited.'
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('A valid reason is required to reverse a posted payment.');
    }

    return {
      reversalId: 'rev-simulated-001',
      paymentId,
      receiptId,
      reason,
      reversedByUserId,
      paymentStatus: 'REVERSED',
      receiptStatus: 'VOIDED',
    };
  }
}
