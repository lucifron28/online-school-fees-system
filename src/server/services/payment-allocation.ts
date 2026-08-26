import { addCentavos, subtractCentavos } from '@/lib/utils/currency';

export type AllocationItem = {
  id: string;
  name: string;
  amountCentavos: number;
  paidCentavos: number;
};

export type PaymentObligation = AllocationItem & {
  assessmentId: string;
  assessmentBalanceCentavos?: number;
  targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
  assessmentItemId: string | null;
  adjustmentId: string | null;
  createdAt: Date;
  assessmentCreatedAt: Date;
};

export type PaymentAllocation = {
  assessmentItemId: string | null;
  adjustmentId: string | null;
  assessmentId: string;
  targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
  name: string;
  amountCentavos: number;
};

export type AllocationGroup = {
  assessmentId: string;
  amountCentavos: number;
};

/**
 * Sequential allocation algorithm: oldest assessment item first, then the
 * next item in persisted order. The caller must supply database-derived items.
 */
export function allocatePaymentToItems(
  paymentAmountCentavos: number,
  items: AllocationItem[]
): Array<{ assessmentItemId: string; name: string; amountCentavos: number }> {
  let remainingPayment = paymentAmountCentavos;
  const allocations: Array<{
    assessmentItemId: string;
    name: string;
    amountCentavos: number;
  }> = [];

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
 * Allocate oldest-first across every persisted positive payment obligation.
 * Assessment items and DEBIT adjustments are both payable targets; CREDIT
 * adjustments never enter this list. The caller must provide database-derived
 * obligations sorted by assessment creation, target creation, and target id.
 */
export function allocatePaymentToObligations(
  paymentAmountCentavos: number,
  obligations: PaymentObligation[]
): PaymentAllocation[] {
  let remainingPayment = paymentAmountCentavos;
  const allocations: PaymentAllocation[] = [];
  const remainingAssessmentCapacity = new Map<string, number | undefined>();

  for (const obligation of obligations) {
    if (remainingPayment <= 0) break;

    const unpaidAmount = subtractCentavos(obligation.amountCentavos, obligation.paidCentavos);
    if (unpaidAmount <= 0) continue;

    if (!remainingAssessmentCapacity.has(obligation.assessmentId)) {
      remainingAssessmentCapacity.set(
        obligation.assessmentId,
        obligation.assessmentBalanceCentavos
      );
    }
    const assessmentCapacity = remainingAssessmentCapacity.get(obligation.assessmentId);
    const allocatable =
      assessmentCapacity === undefined
        ? unpaidAmount
        : Math.min(unpaidAmount, Math.max(0, assessmentCapacity));
    const allocated = Math.min(remainingPayment, allocatable);
    if (allocated <= 0) continue;
    allocations.push({
      assessmentItemId: obligation.assessmentItemId,
      adjustmentId: obligation.adjustmentId,
      assessmentId: obligation.assessmentId,
      targetType: obligation.targetType,
      name: obligation.name,
      amountCentavos: allocated,
    });
    if (assessmentCapacity !== undefined) {
      remainingAssessmentCapacity.set(
        obligation.assessmentId,
        subtractCentavos(assessmentCapacity, allocated)
      );
    }
    remainingPayment = subtractCentavos(remainingPayment, allocated);
  }

  return allocations;
}

export function groupAllocationsByAssessment(allocations: PaymentAllocation[]): AllocationGroup[] {
  const groups = new Map<string, AllocationGroup>();
  for (const allocation of allocations) {
    const current = groups.get(allocation.assessmentId) ?? {
      assessmentId: allocation.assessmentId,
      amountCentavos: 0,
    };
    current.amountCentavos = addCentavos(current.amountCentavos, allocation.amountCentavos);
    groups.set(allocation.assessmentId, current);
  }
  return [...groups.values()];
}
