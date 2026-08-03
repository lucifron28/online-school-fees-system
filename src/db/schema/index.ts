import { pgTable, text, timestamp, boolean, integer, uuid, pgEnum } from 'drizzle-orm/pg-core';

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
export const assessmentStatusEnum = pgEnum('assessment_status', ['DRAFT', 'POSTED', 'CANCELLED']);
export const adjustmentTypeEnum = pgEnum('adjustment_type', ['DEBIT', 'CREDIT']);
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'ASSESSMENT',
  'PAYMENT',
  'REVERSAL',
  'DEBIT_ADJUSTMENT',
  'CREDIT_ADJUSTMENT',
]);

export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'BANK_DEPOSIT', 'MOCK_ONLINE']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'POSTED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
]);
export const receiptStatusEnum = pgEnum('receipt_status', ['ACTIVE', 'VOIDED']);

// ---------------------------------------------------------------------------
// Better Auth Core Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('STUDENT').notNull(), // ADMIN | FINANCE_STAFF | PARENT | STUDENT
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Institution & Academic Core Tables
// ---------------------------------------------------------------------------

export const schoolSettings = pgTable('school_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolName: text('school_name').default('Online School Fees System').notNull(),
  shortName: text('short_name').default('OSFS').notNull(),
  address: text('address').default('123 Education Way, Manila, Philippines').notNull(),
  email: text('email').default('info@schoolfees.example.com').notNull(),
  phone: text('phone').default('+63 (2) 8123-4567').notNull(),
  logoUrl: text('logo_url'),
  receiptPrefix: text('receipt_prefix').default('OSFS').notNull(),
  currencyCode: text('currency_code').default('PHP').notNull(),
  timezone: text('timezone').default('Asia/Manila').notNull(),
  studentPortalEnabled: boolean('student_portal_enabled').default(true).notNull(),
  activeSchoolYearId: uuid('active_school_year_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const schoolYears = pgTable('school_years', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gradeLevels = pgTable('grade_levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sections = pgTable('sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  gradeLevelId: uuid('grade_level_id')
    .notNull()
    .references(() => gradeLevels.id, { onDelete: 'cascade' }),
  schoolYearId: uuid('school_year_id')
    .notNull()
    .references(() => schoolYears.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Student & Guardian Domain Tables
// ---------------------------------------------------------------------------

export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentNumber: text('student_number').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  gradeLevelId: uuid('grade_level_id').references(() => gradeLevels.id),
  sectionId: uuid('section_id').references(() => sections.id),
  schoolYearId: uuid('school_year_id').references(() => schoolYears.id),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const guardians = pgTable('guardians', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  relationship: text('relationship').default('Parent').notNull(),
  address: text('address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const guardianStudents = pgTable('guardian_students', {
  id: uuid('id').defaultRandom().primaryKey(),
  guardianId: uuid('guardian_id')
    .notNull()
    .references(() => guardians.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Fee Category & Structure Domain Tables
// ---------------------------------------------------------------------------

export const feeCategories = pgTable('fee_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const feeStructures = pgTable('fee_structures', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolYearId: uuid('school_year_id')
    .notNull()
    .references(() => schoolYears.id),
  gradeLevelId: uuid('grade_level_id')
    .notNull()
    .references(() => gradeLevels.id),
  name: text('name').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const feeStructureItems = pgTable('fee_structure_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  feeStructureId: uuid('fee_structure_id')
    .notNull()
    .references(() => feeStructures.id, { onDelete: 'cascade' }),
  feeCategoryId: uuid('fee_category_id')
    .notNull()
    .references(() => feeCategories.id),
  name: text('name').notNull(),
  amountCentavos: integer('amount_centavos').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Assessment & Ledger Domain Tables
// ---------------------------------------------------------------------------

export const studentAssessments = pgTable('student_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  schoolYearId: uuid('school_year_id')
    .notNull()
    .references(() => schoolYears.id),
  feeStructureId: uuid('fee_structure_id')
    .notNull()
    .references(() => feeStructures.id),
  totalAmountCentavos: integer('total_amount_centavos').notNull(),
  status: text('status').default('POSTED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assessmentItems = pgTable('assessment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => studentAssessments.id, { onDelete: 'cascade' }),
  feeCategoryId: uuid('fee_category_id')
    .notNull()
    .references(() => feeCategories.id),
  name: text('name').notNull(),
  amountCentavos: integer('amount_centavos').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adjustments = pgTable('adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => studentAssessments.id),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id),
  type: text('type').notNull(),
  amountCentavos: integer('amount_centavos').notNull(),
  reason: text('reason').notNull(),
  approvedByUserId: text('approved_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id').references(() => studentAssessments.id),
  entryType: text('entry_type').notNull(),
  debitCentavos: integer('debit_centavos').default(0).notNull(),
  creditCentavos: integer('credit_centavos').default(0).notNull(),
  balanceCentavos: integer('balance_centavos').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Payment, Receipt, Reversal & Audit Domain Tables (Phase 4)
// ---------------------------------------------------------------------------

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id').references(() => studentAssessments.id),
  amountCentavos: integer('amount_centavos').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(), // CASH | BANK_DEPOSIT | MOCK_ONLINE
  referenceNumber: text('reference_number'),
  status: text('status').default('POSTED').notNull(), // PENDING | POSTED | FAILED | CANCELLED | REVERSED
  processedByUserId: text('processed_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  assessmentItemId: uuid('assessment_item_id')
    .notNull()
    .references(() => assessmentItems.id),
  amountCentavos: integer('amount_centavos').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const receipts = pgTable('receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  receiptNumber: text('receipt_number').notNull().unique(), // e.g. 'OSFS-2026-000001'
  verificationIdentifier: text('verification_identifier').notNull(),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE | VOIDED
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const paymentReversals = pgTable('payment_reversals', {
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // e.g. 'PAYMENT_POSTED', 'PAYMENT_REVERSED'
  entityType: text('entity_type').notNull(), // e.g. 'PAYMENT', 'RECEIPT'
  entityId: text('entity_id').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
