import { getDb } from '../index';
import * as schema from '../schema';
import { seedDemoData } from './seed';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function resetDemoDatabase() {
  console.log('🔄 Resetting demo database state...');
  const db = getDb();

  try {
    await db.delete(schema.auditLogs);
    await db.delete(schema.paymentReversals);
    await db.delete(schema.receipts);
    await db.delete(schema.paymentAllocations);
    await db.delete(schema.payments);
    await db.delete(schema.ledgerEntries);
    await db.delete(schema.adjustments);
    await db.delete(schema.assessmentItems);
    await db.delete(schema.studentAssessments);
    await db.delete(schema.guardianStudents);
    await db.delete(schema.guardians);
    await db.delete(schema.students);
    await db.delete(schema.feeStructureItems);
    await db.delete(schema.feeStructures);
    await db.delete(schema.feeCategories);

    console.log('  ✔ Cleared all transactional & domain demo data tables');
    await seedDemoData();
    console.log('✅ Demo database successfully reset to clean initial state!');
  } catch (error) {
    console.error('❌ Failed to reset demo database:', error);
    process.exit(1);
  }
}

if (process.argv[1]?.includes('reset-demo.ts')) {
  resetDemoDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reset failed:', err);
      process.exit(1);
    });
}
