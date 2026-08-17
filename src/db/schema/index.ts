import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ReceiptSnapshot } from '../../lib/receipt-snapshot';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

// User Role Enum
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT']);

// Academic Status Enums
export const schoolYearStatusEnum = pgEnum('school_year_status', ['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const studentStatusEnum = pgEnum('student_status', [
  'ACTIVE',
  'INACTIVE',
  'WITHDRAWN',
  'GRADUATED',
]);
export const feeStructureStatusEnum = pgEnum('fee_structure_status', [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]);
export const feeCategoryStatusEnum = pgEnum('fee_category_status', ['ACTIVE', 'ARCHIVED']);
export const assessmentPeriodEnum = pgEnum('assessment_period', [
  'ANNUAL',
  'SEMESTER',
  'TRIMESTER',
  'MONTHLY',
]);
export const assessmentStatusEnum = pgEnum('assessment_status', ['DRAFT', 'POSTED', 'CANCELLED']);
export const adjustmentTypeEnum = pgEnum('adjustment_type', ['DEBIT', 'CREDIT']);
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'ASSESSMENT',
  'PAYMENT',
  'REVERSAL',
  'DEBIT_ADJUSTMENT',
  'CREDIT_ADJUSTMENT',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH',
  'BANK_DEPOSIT',
  'GCASH',
  'MAYA',
  'MOCK_ONLINE',
]);
export const paymentSubmissionChannelEnum = pgEnum('payment_submission_channel', ['GCASH', 'MAYA']);
export const paymentSubmissionStatusEnum = pgEnum('payment_submission_status', [
  'PENDING_VERIFICATION',
  'APPROVED',
  'REJECTED',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'POSTED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
]);
export const receiptStatusEnum = pgEnum('receipt_status', ['ACTIVE', 'VOIDED']);
export const mockCheckoutStatusEnum = pgEnum('mock_checkout_status', [
  'CREATED',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);
export const mockCallbackEventTypeEnum = pgEnum('mock_callback_event_type', [
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'PAYMENT_PENDING',
]);
export const mockCallbackProcessingStatusEnum = pgEnum('mock_callback_processing_status', [
  'RECEIVED',
  'PROCESSED',
  'FAILED',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'ASSESSMENT_POSTED',
  'PAYMENT_SUCCESSFUL',
  'RECEIPT_AVAILABLE',
  'PAYMENT_REVERSED',
  'DUE_REMINDER',
  'PAYMENT_DUE_REMINDER',
  'PAYMENT_PROOF_SUBMITTED',
  'PAYMENT_PROOF_REJECTED',
  'ANNOUNCEMENT',
]);
export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'CONSOLE']);
export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'PENDING',
  'SENT',
  'FAILED',
  'RETRYING',
]);
export const notificationAttemptStatusEnum = pgEnum('notification_attempt_status', [
  'RETRYING',
  'SENT',
  'FAILED',
]);

export const announcementAudienceEnum = pgEnum('announcement_audience', [
  'PARENT',
  'STUDENT',
  'PARENT_AND_STUDENT',
]);
export const announcementStatusEnum = pgEnum('announcement_status', [
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED',
]);

// ---------------------------------------------------------------------------
// Better Auth Core Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: userRoleEnum('role').default('STUDENT').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex('accounts_provider_account_unique').on(
      table.providerId,
      table.accountId
    ),
  })
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Institution & Academic Core Tables
// ---------------------------------------------------------------------------

export const schoolYears = pgTable(
  'school_years',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    status: schoolYearStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: uniqueIndex('school_years_name_unique').on(table.name),
    statusIndex: index('school_years_status_idx').on(table.status),
    activeUnique: uniqueIndex('school_years_single_active_unique')
      .on(table.status)
      .where(sql`${table.status} = 'ACTIVE'`),
    datesValid: check('school_years_dates_valid', sql`${table.startDate} < ${table.endDate}`),
  })
);

export const schoolSettings = pgTable(
  'school_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    singletonKey: text('singleton_key').default('default').notNull(),
    schoolName: text('school_name').default('Online School Fees System').notNull(),
    shortName: text('short_name').default('OSFS').notNull(),
    address: text('address').default('123 Education Way, Manila, Philippines').notNull(),
    email: text('email').default('info@schoolfees.example.com').notNull(),
    phone: text('phone').default('+63 (2) 8123-4567').notNull(),
    logoUrl: text('logo_url'),
    receiptPrefix: text('receipt_prefix').default('OSFS').notNull(),
    currencyCode: text('currency_code').default('PHP').notNull(),
    timezone: text('timezone').default('Asia/Manila').notNull(),
    defaultPaymentTermDays: integer('default_payment_term_days').default(7).notNull(),
    reminderLeadDays: integer('reminder_lead_days').default(2).notNull(),
    gcashEnabled: boolean('gcash_enabled').default(false).notNull(),
    gcashAccountName: text('gcash_account_name'),
    gcashAccountNumber: text('gcash_account_number'),
    mayaEnabled: boolean('maya_enabled').default(false).notNull(),
    mayaAccountName: text('maya_account_name'),
    mayaAccountNumber: text('maya_account_number'),
    studentPortalEnabled: boolean('student_portal_enabled').default(true).notNull(),
    activeSchoolYearId: uuid('active_school_year_id').references(() => schoolYears.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    singletonUnique: uniqueIndex('school_settings_singleton_key_unique').on(table.singletonKey),
    paymentTermDaysValid: check(
      'school_settings_payment_term_days_valid',
      sql`${table.defaultPaymentTermDays} BETWEEN 1 AND 365`
    ),
    reminderLeadDaysValid: check(
      'school_settings_reminder_lead_days_valid',
      sql`${table.reminderLeadDays} BETWEEN 0 AND 30`
    ),
    gcashDestinationValid: check(
      'school_settings_gcash_destination_valid',
      sql`${table.gcashEnabled} = false OR (${table.gcashAccountName} IS NOT NULL AND length(trim(${table.gcashAccountName})) > 0 AND ${table.gcashAccountNumber} IS NOT NULL AND length(trim(${table.gcashAccountNumber})) > 0)`
    ),
    mayaDestinationValid: check(
      'school_settings_maya_destination_valid',
      sql`${table.mayaEnabled} = false OR (${table.mayaAccountName} IS NOT NULL AND length(trim(${table.mayaAccountName})) > 0 AND ${table.mayaAccountNumber} IS NOT NULL AND length(trim(${table.mayaAccountNumber})) > 0)`
    ),
  })
);

export const gradeLevels = pgTable(
  'grade_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex('grade_levels_code_unique').on(table.code),
    displayOrderIndex: index('grade_levels_display_order_idx').on(table.displayOrder),
  })
);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gradeLevelId: uuid('grade_level_id')
      .notNull()
      .references(() => gradeLevels.id, { onDelete: 'cascade' }),
    schoolYearId: uuid('school_year_id')
      .notNull()
      .references(() => schoolYears.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    schoolYearCodeUnique: uniqueIndex('sections_school_year_code_unique').on(
      table.schoolYearId,
      table.code
    ),
    schoolYearIndex: index('sections_school_year_idx').on(table.schoolYearId),
    gradeLevelIndex: index('sections_grade_level_idx').on(table.gradeLevelId),
  })
);

// ---------------------------------------------------------------------------
// Student & Guardian Domain Tables
// ---------------------------------------------------------------------------

export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentNumber: text('student_number').notNull().unique(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    gradeLevelId: uuid('grade_level_id').references(() => gradeLevels.id),
    sectionId: uuid('section_id').references(() => sections.id),
    schoolYearId: uuid('school_year_id').references(() => schoolYears.id),
    status: studentStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex('students_user_unique').on(table.userId),
    nameIndex: index('students_last_name_first_name_idx').on(table.lastName, table.firstName),
    emailIndex: index('students_email_idx').on(table.email),
    schoolYearIndex: index('students_school_year_idx').on(table.schoolYearId),
  })
);

export const guardians = pgTable(
  'guardians',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    relationship: text('relationship').default('Parent').notNull(),
    address: text('address').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex('guardians_user_unique').on(table.userId),
    emailIndex: index('guardians_email_idx').on(table.email),
  })
);

export const guardianStudents = pgTable(
  'guardian_students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guardianId: uuid('guardian_id')
      .notNull()
      .references(() => guardians.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    guardianStudentUnique: uniqueIndex('guardian_students_guardian_student_unique').on(
      table.guardianId,
      table.studentId
    ),
    primaryStudentUnique: uniqueIndex('guardian_students_student_primary_unique')
      .on(table.studentId)
      .where(sql`${table.isPrimary} = true`),
    guardianIndex: index('guardian_students_guardian_idx').on(table.guardianId),
    studentIndex: index('guardian_students_student_idx').on(table.studentId),
  })
);

// ---------------------------------------------------------------------------
// Fee Category & Structure Domain Tables
// ---------------------------------------------------------------------------

export const feeCategories = pgTable(
  'fee_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(),
    description: text('description'),
    status: feeCategoryStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIndex: index('fee_categories_status_idx').on(table.status),
  })
);

export const feeStructures = pgTable(
  'fee_structures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    schoolYearId: uuid('school_year_id')
      .notNull()
      .references(() => schoolYears.id),
    gradeLevelId: uuid('grade_level_id')
      .notNull()
      .references(() => gradeLevels.id),
    assessmentPeriod: assessmentPeriodEnum('assessment_period').default('ANNUAL').notNull(),
    name: text('name').notNull(),
    status: feeStructureStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeNameUnique: uniqueIndex('fee_structures_scope_name_unique').on(
      table.schoolYearId,
      table.gradeLevelId,
      table.assessmentPeriod,
      table.name
    ),
    scopeIndex: index('fee_structures_scope_idx').on(
      table.schoolYearId,
      table.gradeLevelId,
      table.assessmentPeriod,
      table.status
    ),
  })
);

export const feeStructureItems = pgTable(
  'fee_structure_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    feeStructureId: uuid('fee_structure_id')
      .notNull()
      .references(() => feeStructures.id, { onDelete: 'cascade' }),
    feeCategoryId: uuid('fee_category_id')
      .notNull()
      .references(() => feeCategories.id),
    name: text('name').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    structureCategoryUnique: uniqueIndex('fee_structure_items_structure_category_unique').on(
      table.feeStructureId,
      table.feeCategoryId
    ),
    amountPositive: check('fee_structure_items_amount_positive', sql`${table.amountCentavos} > 0`),
    structureIndex: index('fee_structure_items_structure_idx').on(table.feeStructureId),
  })
);

// ---------------------------------------------------------------------------
// Assessment & Ledger Domain Tables
// ---------------------------------------------------------------------------

export const studentAssessments = pgTable(
  'student_assessments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    schoolYearId: uuid('school_year_id')
      .notNull()
      .references(() => schoolYears.id),
    feeStructureId: uuid('fee_structure_id')
      .notNull()
      .references(() => feeStructures.id),
    assessmentPeriod: assessmentPeriodEnum('assessment_period').default('ANNUAL').notNull(),
    totalAmountCentavos: integer('total_amount_centavos').notNull(),
    status: assessmentStatusEnum('status').default('POSTED').notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeUnique: uniqueIndex('student_assessments_scope_unique').on(
      table.studentId,
      table.schoolYearId,
      table.assessmentPeriod
    ),
    studentStatusIndex: index('student_assessments_student_status_idx').on(
      table.studentId,
      table.status
    ),
    amountPositive: check(
      'student_assessments_amount_positive',
      sql`${table.totalAmountCentavos} > 0`
    ),
    postedDueDateRequired: check(
      'student_assessments_posted_due_date_required',
      sql`${table.status} <> 'POSTED' OR ${table.dueDate} IS NOT NULL`
    ),
    dueDateIndex: index('student_assessments_due_date_idx').on(table.status, table.dueDate),
  })
);

export const assessmentItems = pgTable(
  'assessment_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => studentAssessments.id, { onDelete: 'cascade' }),
    feeCategoryId: uuid('fee_category_id')
      .notNull()
      .references(() => feeCategories.id),
    name: text('name').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountPositive: check('assessment_items_amount_positive', sql`${table.amountCentavos} > 0`),
    assessmentIndex: index('assessment_items_assessment_idx').on(table.assessmentId),
  })
);

export const adjustments = pgTable(
  'adjustments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => studentAssessments.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    type: adjustmentTypeEnum('type').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    reason: text('reason').notNull(),
    approvedByUserId: text('approved_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountPositive: check('adjustments_amount_positive', sql`${table.amountCentavos} > 0`),
    assessmentIndex: index('adjustments_assessment_idx').on(table.assessmentId),
    studentIndex: index('adjustments_student_idx').on(table.studentId),
  })
);

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    assessmentId: uuid('assessment_id').references(() => studentAssessments.id),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    debitCentavos: integer('debit_centavos').default(0).notNull(),
    creditCentavos: integer('credit_centavos').default(0).notNull(),
    balanceCentavos: integer('balance_centavos').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountsNonNegative: check(
      'ledger_entries_amounts_non_negative',
      sql`${table.debitCentavos} >= 0 AND ${table.creditCentavos} >= 0 AND ${table.balanceCentavos} >= 0`
    ),
    oneSidedAmount: check(
      'ledger_entries_one_sided_amount',
      sql`(${table.debitCentavos} > 0 AND ${table.creditCentavos} = 0) OR (${table.debitCentavos} = 0 AND ${table.creditCentavos} > 0)`
    ),
    studentCreatedIndex: index('ledger_entries_student_created_idx').on(
      table.studentId,
      table.createdAt
    ),
    assessmentIndex: index('ledger_entries_assessment_idx').on(table.assessmentId),
  })
);

// ---------------------------------------------------------------------------
// Payment, Receipt, Reversal & Audit Domain Tables (Phase 4)
// ---------------------------------------------------------------------------

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    assessmentId: uuid('assessment_id').references(() => studentAssessments.id),
    amountCentavos: integer('amount_centavos').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').default('CASH').notNull(),
    referenceNumber: text('reference_number').unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    status: paymentStatusEnum('status').default('POSTED').notNull(),
    processedByUserId: text('processed_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountPositive: check('payments_amount_positive', sql`${table.amountCentavos} > 0`),
    studentStatusCreatedIndex: index('payments_student_status_created_idx').on(
      table.studentId,
      table.status,
      table.createdAt
    ),
    assessmentIndex: index('payments_assessment_idx').on(table.assessmentId),
  })
);

export const paymentSubmissions = pgTable(
  'payment_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    submittedByUserId: text('submitted_by_user_id')
      .notNull()
      .references(() => users.id),
    paymentChannel: paymentSubmissionChannelEnum('payment_channel').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    referenceNumber: text('reference_number').notNull(),
    normalizedReferenceNumber: text('normalized_reference_number').notNull(),
    destinationAccountName: text('destination_account_name'),
    destinationAccountNumber: text('destination_account_number'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    status: paymentSubmissionStatusEnum('status').default('PENDING_VERIFICATION').notNull(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    approvedPaymentId: uuid('approved_payment_id')
      .unique()
      .references(() => payments.id),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountPositive: check('payment_submissions_amount_positive', sql`${table.amountCentavos} > 0`),
    referenceLengthValid: check(
      'payment_submissions_reference_length_valid',
      sql`length(trim(${table.referenceNumber})) BETWEEN 1 AND 120`
    ),
    rejectionReasonRequired: check(
      'payment_submissions_rejection_reason_required',
      sql`${table.status} <> 'REJECTED' OR (${table.rejectionReason} IS NOT NULL AND length(trim(${table.rejectionReason})) > 0)`
    ),
    approvedPaymentRequired: check(
      'payment_submissions_approved_payment_required',
      sql`${table.status} <> 'APPROVED' OR ${table.approvedPaymentId} IS NOT NULL`
    ),
    destinationSnapshotConsistent: check(
      'payment_submissions_destination_snapshot_consistent',
      sql`(${table.destinationAccountName} IS NULL AND ${table.destinationAccountNumber} IS NULL) OR (${table.destinationAccountName} IS NOT NULL AND length(trim(${table.destinationAccountName})) > 0 AND ${table.destinationAccountNumber} IS NOT NULL AND length(trim(${table.destinationAccountNumber})) > 0)`
    ),
    lifecycleConsistent: check(
      'payment_submissions_lifecycle_consistent',
      sql`(${table.status} = 'PENDING_VERIFICATION' AND ${table.reviewedByUserId} IS NULL AND ${table.reviewedAt} IS NULL AND ${table.rejectionReason} IS NULL AND ${table.approvedPaymentId} IS NULL) OR (${table.status} = 'APPROVED' AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.rejectionReason} IS NULL AND ${table.approvedPaymentId} IS NOT NULL) OR (${table.status} = 'REJECTED' AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.rejectionReason} IS NOT NULL AND length(trim(${table.rejectionReason})) > 0 AND ${table.approvedPaymentId} IS NULL)`
    ),
    statusChannelCreatedIndex: index('payment_submissions_status_channel_created_idx').on(
      table.status,
      table.paymentChannel,
      table.createdAt
    ),
    studentStatusIndex: index('payment_submissions_student_status_idx').on(
      table.studentId,
      table.status
    ),
    submitterCreatedIndex: index('payment_submissions_submitter_created_idx').on(
      table.submittedByUserId,
      table.createdAt
    ),
    activeReferenceUnique: uniqueIndex('payment_submissions_active_reference_unique')
      .on(table.paymentChannel, table.normalizedReferenceNumber)
      .where(sql`${table.status} IN ('PENDING_VERIFICATION', 'APPROVED')`),
  })
);

export const paymentSubmissionProofs = pgTable(
  'payment_submission_proofs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => paymentSubmissions.id),
    mimeType: text('mime_type').notNull(),
    originalFileName: text('original_file_name').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    submissionUnique: uniqueIndex('payment_submission_proofs_submission_unique').on(
      table.submissionId
    ),
    mimeTypeValid: check(
      'payment_submission_proofs_mime_type_valid',
      sql`${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`
    ),
    sizeValid: check(
      'payment_submission_proofs_size_valid',
      sql`${table.sizeBytes} BETWEEN 1 AND 3145728 AND octet_length(${table.data}) BETWEEN 1 AND 3145728`
    ),
    fileNameLengthValid: check(
      'payment_submission_proofs_filename_length_valid',
      sql`length(trim(${table.originalFileName})) BETWEEN 1 AND 160`
    ),
    sha256FormatValid: check(
      'payment_submission_proofs_sha256_format_valid',
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`
    ),
  })
);

export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    assessmentItemId: uuid('assessment_item_id').references(() => assessmentItems.id),
    adjustmentId: uuid('adjustment_id').references(() => adjustments.id),
    amountCentavos: integer('amount_centavos').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentItemUnique: uniqueIndex('payment_allocations_payment_item_unique').on(
      table.paymentId,
      table.assessmentItemId
    ),
    paymentAdjustmentUnique: uniqueIndex('payment_allocations_payment_adjustment_unique').on(
      table.paymentId,
      table.adjustmentId
    ),
    amountPositive: check('payment_allocations_amount_positive', sql`${table.amountCentavos} > 0`),
    exactlyOneTarget: check(
      'payment_allocations_exactly_one_target',
      sql`(${table.assessmentItemId} IS NOT NULL AND ${table.adjustmentId} IS NULL) OR (${table.assessmentItemId} IS NULL AND ${table.adjustmentId} IS NOT NULL)`
    ),
    assessmentItemIndex: index('payment_allocations_assessment_item_idx').on(
      table.assessmentItemId
    ),
    adjustmentIndex: index('payment_allocations_adjustment_idx').on(table.adjustmentId),
  })
);

export const receipts = pgTable(
  'receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    receiptNumber: text('receipt_number').notNull().unique(), // e.g. 'OSFS-2026-000001'
    verificationIdentifier: text('verification_identifier').notNull().unique(),
    status: receiptStatusEnum('status').default('ACTIVE').notNull(),
    issuanceSnapshot: jsonb('issuance_snapshot').$type<ReceiptSnapshot | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentUnique: uniqueIndex('receipts_payment_unique').on(table.paymentId),
  })
);

export const receiptNumberSequences = pgTable(
  'receipt_number_sequences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    prefix: text('prefix').notNull(),
    year: integer('year').notNull(),
    lastSequence: integer('last_sequence').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    prefixYearUnique: uniqueIndex('receipt_number_sequences_prefix_year_unique').on(
      table.prefix,
      table.year
    ),
    sequencePositive: check(
      'receipt_number_sequences_last_sequence_positive',
      sql`${table.lastSequence} > 0`
    ),
  })
);

export const paymentReversals = pgTable(
  'payment_reversals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => receipts.id),
    reason: text('reason').notNull(),
    reversedByUserId: text('reversed_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentUnique: uniqueIndex('payment_reversals_payment_unique').on(table.paymentId),
  })
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id),
    action: text('action').notNull(), // e.g. 'PAYMENT_POSTED', 'PAYMENT_REVERSED'
    entityType: text('entity_type').notNull(), // e.g. 'PAYMENT', 'RECEIPT'
    entityId: text('entity_id').notNull(),
    details: text('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityIndex: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    userCreatedIndex: index('audit_logs_user_created_idx').on(table.userId, table.createdAt),
  })
);

// ---------------------------------------------------------------------------
// Mock Payment Persistence
// ---------------------------------------------------------------------------

export const mockPaymentCheckouts = pgTable(
  'mock_payment_checkouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    checkoutReference: text('checkout_reference').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    assessmentId: uuid('assessment_id').references(() => studentAssessments.id),
    paymentId: uuid('payment_id')
      .unique()
      .references(() => payments.id),
    paymentChannel: text('payment_channel').default('GCash').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    status: mockCheckoutStatusEnum('status').default('CREATED').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    amountPositive: check(
      'mock_payment_checkouts_amount_positive',
      sql`${table.amountCentavos} > 0`
    ),
    paymentChannelValid: check(
      'mock_payment_checkouts_payment_channel_valid',
      sql`${table.paymentChannel} IN ('GCash', 'Maya', 'CreditCard')`
    ),
    studentStatusCreatedIndex: index('mock_payment_checkouts_student_status_created_idx').on(
      table.studentId,
      table.status,
      table.createdAt
    ),
    assessmentIndex: index('mock_payment_checkouts_assessment_idx').on(table.assessmentId),
  })
);

export const mockPaymentCallbackEvents = pgTable(
  'mock_payment_callback_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => mockPaymentCheckouts.id),
    eventId: text('event_id').notNull().unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    eventType: mockCallbackEventTypeEnum('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processingStatus: mockCallbackProcessingStatusEnum('processing_status')
      .default('RECEIVED')
      .notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  (table) => ({
    checkoutEventIndex: index('mock_payment_callback_events_checkout_idx').on(table.checkoutId),
    statusReceivedIndex: index('mock_payment_callback_events_status_received_idx').on(
      table.processingStatus,
      table.receivedAt
    ),
  })
);

// ---------------------------------------------------------------------------
// Payment Announcements
// ---------------------------------------------------------------------------

export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    audience: announcementAudienceEnum('audience').notNull(),
    status: announcementStatusEnum('status').default('DRAFT').notNull(),
    publishAt: timestamp('publish_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    updatedByUserId: text('updated_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusPublishIndex: index('announcements_status_publish_idx').on(table.status, table.publishAt),
    expiresIndex: index('announcements_expires_idx').on(table.expiresAt),
    datesValid: check(
      'announcements_dates_valid',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.publishAt}`
    ),
  })
);

// ---------------------------------------------------------------------------
// Notification Delivery
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: notificationTypeEnum('type').notNull(),
    dedupeKey: text('dedupe_key').notNull().unique(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIndex: index('notifications_user_created_idx').on(table.userId, table.createdAt),
    entityIndex: index('notifications_entity_idx').on(table.entityType, table.entityId),
  })
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    status: notificationDeliveryStatusEnum('status').default('PENDING').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    providerMessageId: text('provider_message_id'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    notificationChannelUnique: uniqueIndex(
      'notification_deliveries_notification_channel_unique'
    ).on(table.notificationId, table.channel),
    pendingIndex: index('notification_deliveries_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt
    ),
    attemptCountNonNegative: check(
      'notification_deliveries_attempt_count_non_negative',
      sql`${table.attemptCount} >= 0`
    ),
  })
);

export const notificationDeliveryAttempts = pgTable(
  'notification_delivery_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => notificationDeliveries.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: notificationAttemptStatusEnum('status').default('RETRYING').notNull(),
    providerMessageId: text('provider_message_id'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    deliveryAttemptUnique: uniqueIndex('notification_delivery_attempts_delivery_number_unique').on(
      table.deliveryId,
      table.attemptNumber
    ),
    attemptNumberPositive: check(
      'notification_delivery_attempts_attempt_number_positive',
      sql`${table.attemptNumber} > 0`
    ),
  })
);
