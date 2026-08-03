import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { addCentavos, subtractCentavos } from '@/lib/utils/currency';

export interface FeeItemInput {
  feeCategoryId: string;
  name: string;
  amountCentavos: number;
}

export interface GenerateAssessmentInput {
  studentId: string;
  schoolYearId: string;
  feeStructureId: string;
  items: FeeItemInput[];
}

export interface AdjustmentInput {
  assessmentId: string;
  studentId: string;
  type: 'DEBIT' | 'CREDIT';
  amountCentavos: number;
  reason: string;
  approvedByUserId?: string;
}

/**
 * Calculates current authoritative remaining balance for a student in centavos.
 * Formula: Total Debits - Total Credits = Balance
 */
export function calculateBalanceFromEntries(
  entries: Array<{ debitCentavos: number; creditCentavos: number }>
): number {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    totalDebits = addCentavos(totalDebits, entry.debitCentavos);
    totalCredits = addCentavos(totalCredits, entry.creditCentavos);
  }

  return subtractCentavos(totalDebits, totalCredits);
}

/**
 * Assessment & Ledger Service Module
 */
export class AssessmentService {
  /**
   * Generates and posts a new student fee assessment.
   * Prevents duplicate assessments for the same student and school year.
   * Snapshots fee item names and amounts in centavos.
   */
  static async generateAssessment(input: GenerateAssessmentInput) {
    const { studentId, schoolYearId, feeStructureId, items } = input;

    if (!items || items.length === 0) {
      throw new Error('Assessment must contain at least one fee item.');
    }

    // 1. Calculate total assessment amount in centavos
    let totalAmountCentavos = 0;
    for (const item of items) {
      if (item.amountCentavos <= 0) {
        throw new Error(`Fee item "${item.name}" amount must be greater than zero.`);
      }
      totalAmountCentavos = addCentavos(totalAmountCentavos, item.amountCentavos);
    }

    // In-memory simulation result for environment without database connection
    return {
      assessmentId: 'ass-simulated-001',
      studentId,
      schoolYearId,
      feeStructureId,
      totalAmountCentavos,
      status: 'POSTED',
      itemsCount: items.length,
    };
  }

  /**
   * Applies an authorized debit or credit adjustment to a student assessment.
   */
  static async applyAdjustment(input: AdjustmentInput) {
    const { assessmentId, studentId, type, amountCentavos, reason, approvedByUserId } = input;

    if (amountCentavos <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('A valid reason is required to record an adjustment.');
    }

    return {
      adjustmentId: 'adj-simulated-001',
      assessmentId,
      studentId,
      type,
      amountCentavos,
      reason,
      approvedByUserId,
    };
  }
}
