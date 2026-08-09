export interface PortalChild {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  schoolYearName: string | null;
  outstandingBalanceCentavos: number;
  totalPaidCentavos: number;
}

export interface PortalPayment {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: string;
  receiptId: string | null;
  receiptNumber: string | null;
  receiptStatus: string | null;
  balanceAfterPaymentCentavos: number | null;
  allocations: Array<{
    targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
    name: string;
    amountCentavos: number;
  }>;
}

export interface PortalAssessmentItem {
  id: string;
  name: string;
  amountCentavos: number;
  feeCategoryName: string;
}

export interface PortalAssessment {
  id: string;
  schoolYearName: string;
  feeStructureName: string;
  assessmentPeriod: string;
  totalAmountCentavos: number;
  balanceCentavos: number;
  status: string;
  items: PortalAssessmentItem[];
}

export interface PortalLedgerEntry {
  id: string;
  entryType: string;
  debitCentavos: number;
  creditCentavos: number;
  balanceCentavos: number;
  description: string;
  createdAt: string;
}

export interface PortalAccount {
  student: PortalChild;
  assessments: PortalAssessment[];
  ledger: {
    entries: PortalLedgerEntry[];
    balanceCentavos: number;
  };
  payments: PortalPayment[];
}

export interface MockCheckout {
  id: string;
  paymentReference: string;
  studentId: string;
  assessmentId: string | null;
  amountCentavos: number;
  status: 'CREATED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  paymentId: string | null;
  expiresAt: string | null;
  completedAt: string | null;
}

export interface MockCheckoutResult {
  checkoutId: string;
  paymentReference: string;
  redirectUrl: string;
  status: 'CREATED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
}
