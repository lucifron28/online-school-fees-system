/**
 * Centralized Money Utility for Philippine Pesos (PHP, ₱)
 *
 * INVARIANT: Money is stored internally as integer centavos (₱1.00 = 100 centavos).
 * JavaScript floating-point arithmetic MUST NOT be used for monetary calculations.
 */

const MAX_SAFE_CENTAVOS = 2_147_483_647; // PostgreSQL 32-bit integer limit

/**
 * Exact string-based decimal peso to integer centavos parser.
 * Does NOT use parseFloat, Number(str) * 100, or binary floating-point multiplication.
 */
export function parsePesoStringToCentavos(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || Number.isNaN(input)) {
      throw new Error(`Invalid peso amount: ${input}`);
    }
    input = input.toString();
  }

  if (typeof input !== 'string') {
    throw new Error(`Invalid peso amount: ${String(input)}`);
  }

  let trimmed = input.trim();
  if (trimmed.startsWith('₱')) {
    trimmed = trimmed.slice(1).trim();
  } else if (trimmed.toUpperCase().startsWith('PHP')) {
    trimmed = trimmed.slice(3).trim();
  }
  trimmed = trimmed.replace(/,/g, '');

  if (trimmed === '') {
    throw new Error('Invalid peso amount: empty input');
  }

  if (trimmed.startsWith('-')) {
    throw new Error(`Invalid peso amount: negative values are not allowed (${input})`);
  }

  // Strict regex: one or more digits, optional decimal point with 0 to 2 fractional digits
  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid peso amount: ${input}`);
  }

  const wholeStr = match[1] ?? '0';
  const fractionStr = match[2] ?? '';

  if (fractionStr.length > 2) {
    throw new Error(`Invalid peso amount: excessive decimal places in ${input}`);
  }

  const paddedFraction = fractionStr.padEnd(2, '0');
  const whole = Number.parseInt(wholeStr, 10);
  const fraction = Number.parseInt(paddedFraction, 10);

  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) {
    throw new Error(`Invalid peso amount: value exceeds safe integer range (${input})`);
  }

  const centavos = whole * 100 + fraction;
  if (!Number.isSafeInteger(centavos) || centavos > MAX_SAFE_CENTAVOS || centavos < 0) {
    throw new Error(`Invalid peso amount: value exceeds allowed range (${input})`);
  }

  return centavos;
}

/**
 * Converts pesos to centavos integer using exact string parsing.
 * Example: "1500.50" -> 150050, 1500 -> 150000
 */
export function pesosToCentavos(pesos: number | string): number {
  return parsePesoStringToCentavos(pesos);
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
  return parsePesoStringToCentavos(input);
}
