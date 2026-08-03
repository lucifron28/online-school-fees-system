export interface CheckoutInput {
  studentId: string;
  assessmentId: string;
  amountCentavos: number;
  paymentChannel: 'GCash' | 'Maya' | 'CreditCard';
  returnUrl: string;
  parentUserId: string;
}

export interface CheckoutResult {
  checkoutId: string;
  paymentReference: string;
  redirectUrl: string;
}

export interface PaymentVerification {
  paymentReference: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING';
  amountCentavos: number;
  studentId: string;
  paidAt?: Date;
  isAlreadyProcessed?: boolean;
}

export interface PaymentGateway {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyPayment(paymentReference: string): Promise<PaymentVerification>;
}

// In-memory idempotency store for payment references
const processedReferences = new Map<
  string,
  { status: string; amountCentavos: number; studentId: string }
>();

export class MockPaymentGateway implements PaymentGateway {
  /**
   * Creates a mock online checkout session.
   */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (input.amountCentavos <= 0) {
      throw new Error('Checkout amount must be greater than zero.');
    }

    const checkoutId = `chk_${Math.random().toString(36).substring(2, 12)}`;
    const paymentReference = `PAY-ONLINE-${Math.floor(100000 + Math.random() * 900000)}`;
    const redirectUrl = `/parent/pay/mock-checkout?ref=${paymentReference}&amt=${input.amountCentavos}&channel=${input.paymentChannel}&studentId=${input.studentId}`;

    return {
      checkoutId,
      paymentReference,
      redirectUrl,
    };
  }

  /**
   * Server-side payment verification with strict IDEMPOTENCY guarantee.
   * Duplicate callback calls return `isAlreadyProcessed: true` and do NOT re-post payment.
   */
  async verifyPayment(paymentReference: string): Promise<PaymentVerification> {
    if (!paymentReference || !paymentReference.startsWith('PAY-ONLINE-')) {
      throw new Error('UNKNOWN_REFERENCE: The specified payment reference does not exist.');
    }

    // Idempotency Check: if already processed, return existing status with isAlreadyProcessed: true
    if (processedReferences.has(paymentReference)) {
      const existing = processedReferences.get(paymentReference)!;
      return {
        paymentReference,
        status: existing.status as any,
        amountCentavos: existing.amountCentavos,
        studentId: existing.studentId,
        paidAt: new Date(),
        isAlreadyProcessed: true,
      };
    }

    // Default simulation result for unhandled references
    return {
      paymentReference,
      status: 'SUCCESS',
      amountCentavos: 1400000,
      studentId: 'std-001',
      paidAt: new Date(),
      isAlreadyProcessed: false,
    };
  }

  /**
   * Simulates processing a callback outcome (SUCCESS, FAILED, CANCELLED) and stores reference for idempotency.
   */
  static processCallback(
    paymentReference: string,
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
    amountCentavos: number,
    studentId: string
  ) {
    if (processedReferences.has(paymentReference)) {
      return {
        isAlreadyProcessed: true,
        status: processedReferences.get(paymentReference)!.status,
      };
    }

    processedReferences.set(paymentReference, { status, amountCentavos, studentId });
    return { isAlreadyProcessed: false, status };
  }

  /**
   * Resets idempotency memory store (for testing).
   */
  static clearStore() {
    processedReferences.clear();
  }
}
