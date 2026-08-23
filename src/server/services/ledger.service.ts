import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '@/db';
import * as schema from '@/db/schema';
import { NotFoundError } from '@/server/errors';

/**
 * Every application ledger mutation must acquire this PostgreSQL row lock before
 * reading the student's ledger or writing a new financial entry. Keeping one
 * helper for the boundary prevents payment and assessment code from drifting
 * into different concurrency rules.
 */
export async function lockStudentForLedgerMutation(
  studentId: string,
  db: DatabaseClient
): Promise<typeof schema.students.$inferSelect> {
  const rows = await db
    .select()
    .from(schema.students)
    .where(eq(schema.students.id, studentId))
    .for('update')
    .limit(1);

  if (!rows[0]) throw new NotFoundError('The student does not exist.');
  return rows[0];
}

export function calculateNetPaidFromEntries(
  entries: Array<{
    entryType: string;
    debitCentavos: number;
    creditCentavos: number;
  }>
) {
  return entries.reduce((total, entry) => {
    if (entry.entryType === 'PAYMENT') return total + entry.creditCentavos;
    if (entry.entryType === 'REVERSAL') return total - entry.debitCentavos;
    return total;
  }, 0);
}
