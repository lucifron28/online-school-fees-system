/**
 * Centralized Money Utility for Philippine Pesos (PHP, ₱)
 *
 * INVARIANT: Money is stored internally as integer centavos (₱1.00 = 100 centavos).
 * JavaScript floating-point arithmetic MUST NOT be used for monetary calculations.
 */

/**
 * Converts pesos to centavos integer.
 * Example: 1500.50 -> 150050
 */
export function pesosToCentavos(pesos: number | string): number {
  const parsed = typeof pesos === 'string' ? parseFloat(pesos.replace(/[^0-9.-]+/g, '')) : pesos;
  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new Error(`Invalid peso amount: ${pesos}`);
  }
  return Math.round(parsed * 100);
}

/**
 * Converts integer centavos to pesos number.
 * Example: 150050 -> 1500.50
 */
export function centavosToPesos(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new Error(`Centavos amount must be an integer: ${centavos}`);
  }
  return centavos / 100;
}

/**
 * Formats integer centavos as Philippine Peso currency string.
 * Example: 150050 -> "₱1,500.50"
 */
export function formatCentavos(centavos: number): string {
  const pesos = centavosToPesos(centavos);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Formats integer centavos for PDF output (using ASCII "PHP" prefix to avoid WinAnsi encoding issues).
 * Example: 150050 -> "PHP 1,500.50"
 */
export function formatCentavosForPdf(centavos: number): string {
  const pesos = centavosToPesos(centavos);
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
  return `PHP ${formatted}`;
}

/**
 * Safe addition of centavos.
 */
export function addCentavos(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error('Centavo operands must be integers');
  }
  return a + b;
}

/**
 * Safe subtraction of centavos.
 */
export function subtractCentavos(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error('Centavo operands must be integers');
  }
  return a - b;
}

/**
 * Parses user money input string into integer centavos.
 * Accepts formats like "1500", "1,500.00", "₱1,500.00".
 * Throws Error for negative or non-monetary inputs.
 */
export function parseMoneyInput(input: string): number {
  const cleaned = input.trim().replace(/₱|\s|,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Invalid monetary input. Please enter a positive amount (e.g. 1500.00)');
  }
  return pesosToCentavos(cleaned);
}
