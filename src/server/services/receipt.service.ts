import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { AppError } from '@/server/errors';

export function getReceiptYear(date: Date, timeZone: string) {
  try {
    const year = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
    })
      .formatToParts(date)
      .find((part) => part.type === 'year')?.value;

    if (!year) throw new Error('The configured timezone did not produce a calendar year.');
    return Number(year);
  } catch {
    throw new AppError('The configured school timezone is invalid for receipt numbering.');
  }
}

export function formatReceiptNumber(prefix: string, year: number, sequence: number) {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix)
    throw new AppError('A receipt prefix must be configured before payment posting.');
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AppError('The receipt sequence allocation is invalid.');
  }
  return `${normalizedPrefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Allocates the next receipt number inside the payment transaction. PostgreSQL
 * serializes the unique-prefix/year upsert, so concurrent payments cannot
 * receive the same human-facing sequence.
 */
export async function allocateReceiptNumber(db: DatabaseInstance, createdAt: Date) {
  const settings = await db
    .select({
      receiptPrefix: schema.schoolSettings.receiptPrefix,
      timezone: schema.schoolSettings.timezone,
    })
    .from(schema.schoolSettings)
    .limit(1);
  const institution = settings[0];
  if (!institution) {
    throw new AppError(
      'School settings must be configured before issuing a payment acknowledgment receipt.'
    );
  }

  const prefix = institution.receiptPrefix.trim();
  const year = getReceiptYear(createdAt, institution.timezone);
  const [sequence] = await db
    .insert(schema.receiptNumberSequences)
    .values({ prefix, year, lastSequence: 1 })
    .onConflictDoUpdate({
      target: [schema.receiptNumberSequences.prefix, schema.receiptNumberSequences.year],
      set: {
        lastSequence: sql`${schema.receiptNumberSequences.lastSequence} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ sequence: schema.receiptNumberSequences.lastSequence });

  if (!sequence) throw new AppError('The receipt sequence could not be allocated.');
  return {
    prefix,
    year,
    sequence: sequence.sequence,
    receiptNumber: formatReceiptNumber(prefix, year, sequence.sequence),
  };
}
