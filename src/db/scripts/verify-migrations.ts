import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { logSanitizedError } from '../../server/logging';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const expectedTables = [
  'accounts',
  'adjustments',
  'assessment_items',
  'audit_logs',
  'fee_categories',
  'fee_structure_items',
  'fee_structures',
  'grade_levels',
  'guardian_students',
  'guardians',
  'ledger_entries',
  'mock_payment_callback_events',
  'mock_payment_checkouts',
  'notification_delivery_attempts',
  'notification_deliveries',
  'notifications',
  'payment_allocations',
  'payment_reversals',
  'payment_submission_proofs',
  'payment_submissions',
  'payments',
  'receipts',
  'receipt_number_sequences',
  'school_settings',
  'school_years',
  'sections',
  'sessions',
  'student_assessments',
  'students',
  'users',
  'verifications',
  'announcements',
];

const expectedIndexes = [
  'guardian_students_guardian_student_unique',
  'guardian_students_student_primary_unique',
  'student_assessments_scope_unique',
  'receipts_payment_unique',
  'payment_reversals_payment_unique',
  'payment_allocations_payment_adjustment_unique',
  'payment_submission_proofs_submission_unique',
  'payment_submissions_active_reference_unique',
  'payment_submissions_idempotency_key_unique',
  'payment_submissions_approved_payment_id_unique',
  'payment_submissions_status_channel_created_idx',
  'payment_submissions_student_status_idx',
  'payment_submissions_submitter_created_idx',
  'announcements_status_publish_idx',
  'announcements_expires_idx',
  'payment_allocations_adjustment_idx',
  'payments_reference_number_unique',
  'payments_idempotency_key_unique',
  'mock_payment_checkouts_checkout_reference_unique',
  'mock_payment_checkouts_idempotency_key_unique',
  'mock_payment_callback_events_event_id_unique',
  'mock_payment_callback_events_idempotency_key_unique',
  'notification_delivery_attempts_delivery_number_unique',
  'receipt_number_sequences_prefix_year_unique',
];

const expectedChecks = [
  'fee_structure_items_amount_positive',
  'student_assessments_amount_positive',
  'assessment_items_amount_positive',
  'adjustments_amount_positive',
  'ledger_entries_amounts_non_negative',
  'ledger_entries_one_sided_amount',
  'payments_amount_positive',
  'payment_allocations_amount_positive',
  'mock_payment_checkouts_amount_positive',
  'notification_deliveries_attempt_count_non_negative',
  'notification_delivery_attempts_attempt_number_positive',
  'receipt_number_sequences_last_sequence_positive',
  'payment_allocations_exactly_one_target',
  'mock_payment_checkouts_payment_channel_valid',
  'payment_submissions_amount_positive',
  'payment_submissions_reference_length_valid',
  'payment_submissions_rejection_reason_required',
  'payment_submissions_approved_payment_required',
  'payment_submissions_destination_snapshot_consistent',
  'payment_submissions_lifecycle_consistent',
  'payment_submission_proofs_mime_type_valid',
  'payment_submission_proofs_size_valid',
  'payment_submission_proofs_filename_length_valid',
  'payment_submission_proofs_sha256_format_valid',
  'announcements_dates_valid',
];

const expectedColumns = [
  ['payment_allocations', 'assessment_item_id'],
  ['payment_allocations', 'adjustment_id'],
  ['mock_payment_checkouts', 'payment_channel'],
] as const;

const expectedEnumColumns = [
  ['users', 'role', 'user_role'],
  ['school_years', 'status', 'school_year_status'],
  ['students', 'status', 'student_status'],
  ['fee_structures', 'status', 'fee_structure_status'],
  ['student_assessments', 'assessment_period', 'assessment_period'],
  ['student_assessments', 'status', 'assessment_status'],
  ['payments', 'payment_method', 'payment_method'],
  ['payments', 'status', 'payment_status'],
  ['payment_submissions', 'payment_channel', 'payment_submission_channel'],
  ['payment_submissions', 'status', 'payment_submission_status'],
  ['receipts', 'status', 'receipt_status'],
  ['mock_payment_checkouts', 'status', 'mock_checkout_status'],
  ['mock_payment_callback_events', 'event_type', 'mock_callback_event_type'],
  ['notifications', 'type', 'notification_type'],
  ['notification_deliveries', 'channel', 'notification_channel'],
  ['notification_deliveries', 'status', 'notification_delivery_status'],
  ['notification_delivery_attempts', 'status', 'notification_attempt_status'],
  ['announcements', 'audience', 'announcement_audience'],
  ['announcements', 'status', 'announcement_status'],
] as const;

const financialTimestampTables = [
  'student_assessments',
  'ledger_entries',
  'payments',
  'payment_allocations',
  'receipts',
  'payment_reversals',
  'mock_payment_checkouts',
  'mock_payment_callback_events',
  'audit_logs',
  'payment_submissions',
  'payment_submission_proofs',
];

const financialHistoryTables = [
  'student_assessments',
  'ledger_entries',
  'payments',
  'payment_allocations',
  'receipts',
  'payment_reversals',
  'mock_payment_checkouts',
  'mock_payment_callback_events',
  'payment_submissions',
  'payment_submission_proofs',
];

function assertComplete(actual: string[], expected: string[], label: string) {
  const missing = expected.filter((value) => !actual.includes(value));
  if (missing.length > 0) {
    throw new Error(`${label} missing: ${missing.join(', ')}`);
  }
}

async function expectQueryFailure(client: Client, query: string, values: unknown[], label: string) {
  await client.query('SAVEPOINT migration_contract_failure');
  let failed = false;
  try {
    await client.query(query, values);
  } catch {
    failed = true;
  }
  await client.query('ROLLBACK TO SAVEPOINT migration_contract_failure');
  if (!failed) {
    throw new Error(`${label} was accepted by the database.`);
  }
}

async function verifyMigrationContract() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for migration verification.');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tableResult = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [expectedTables]
    );
    assertComplete(
      tableResult.rows.map((row) => row.table_name),
      expectedTables,
      'Tables'
    );

    const indexResult = await client.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])`,
      [expectedIndexes]
    );
    assertComplete(
      indexResult.rows.map((row) => row.indexname),
      expectedIndexes,
      'Required indexes'
    );

    const checkResult = await client.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE contype = 'c'
         AND conname = ANY($1::text[])`,
      [expectedChecks]
    );
    assertComplete(
      checkResult.rows.map((row) => row.conname),
      expectedChecks,
      'Monetary/check constraints'
    );

    const columnResult = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (
           SELECT value->>0, value->>1
           FROM jsonb_array_elements($1::jsonb) AS value
         )`,
      [JSON.stringify(expectedColumns)]
    );
    assertComplete(
      columnResult.rows.map((row) => `${row.table_name}:${row.column_name}`),
      expectedColumns.map((value) => value.join(':')),
      'Round 2 payment columns'
    );

    const enumResult = await client.query<{
      table_name: string;
      column_name: string;
      udt_name: string;
    }>(
      `SELECT table_name, column_name, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name, udt_name) IN (
           SELECT value->>0, value->>1, value->>2
           FROM jsonb_array_elements($1::jsonb) AS value
         )`,
      [JSON.stringify(expectedEnumColumns)]
    );
    const actualEnumColumns = enumResult.rows.map((row) =>
      [row.table_name, row.column_name, row.udt_name].join(':')
    );
    const expectedEnumColumnNames = expectedEnumColumns.map((value) => value.join(':'));
    assertComplete(actualEnumColumns, expectedEnumColumnNames, 'Enum columns');

    const timestampResult = await client.query<{ table_name: string }>(
      `SELECT DISTINCT table_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('created_at', 'received_at', 'completed_at')
         AND data_type = 'timestamp with time zone'
         AND table_name = ANY($1::text[])`,
      [financialTimestampTables]
    );
    assertComplete(
      timestampResult.rows.map((row) => row.table_name),
      financialTimestampTables,
      'Financial timestamp columns'
    );

    const cascadeResult = await client.query<{
      child_table: string;
      parent_table: string;
    }>(
      `SELECT child.relname AS child_table, parent.relname AS parent_table
       FROM pg_constraint constraint_row
       JOIN pg_class child ON child.oid = constraint_row.conrelid
       JOIN pg_class parent ON parent.oid = constraint_row.confrelid
       WHERE constraint_row.contype = 'f'
         AND constraint_row.confdeltype = 'c'
         AND child.relname = ANY($1::text[])`,
      [financialHistoryTables]
    );
    if (cascadeResult.rows.length > 0) {
      throw new Error(
        `Financial history has destructive cascade(s): ${cascadeResult.rows
          .map((row) => `${row.child_table}->${row.parent_table}`)
          .join(', ')}`
      );
    }

    await client.query('BEGIN');
    const studentId = '00000000-0000-0000-0000-000000000001';
    await client.query(
      `INSERT INTO students (id, student_number, first_name, last_name, email)
       VALUES ($1, 'VERIFY-0001', 'Migration', 'Contract', 'migration-contract@example.test')`,
      [studentId]
    );
    await expectQueryFailure(
      client,
      `INSERT INTO payments (student_id, amount_centavos, idempotency_key)
       VALUES ($1, 0, 'verify-zero-payment')`,
      [studentId],
      'Zero-centavo payment'
    );
    await client.query(
      `INSERT INTO payments (student_id, amount_centavos, idempotency_key)
       VALUES ($1, 100, 'verify-payment-unique')`,
      [studentId]
    );
    await expectQueryFailure(
      client,
      `INSERT INTO payments (student_id, amount_centavos, idempotency_key)
       VALUES ($1, 100, 'verify-payment-unique')`,
      [studentId],
      'Duplicate payment idempotency key'
    );
    await expectQueryFailure(
      client,
      'DELETE FROM students WHERE id = $1',
      [studentId],
      'Student deletion with financial history'
    );
    await client.query('ROLLBACK');

    console.log(
      `Migration contract verified: ${expectedTables.length} tables, ${expectedIndexes.length} unique indexes, ${expectedChecks.length} checks, and financial delete protection.`
    );
  } finally {
    await client.end();
  }
}

verifyMigrationContract().catch((error: unknown) => {
  logSanitizedError('verification.migrations', error);
  process.exit(1);
});
