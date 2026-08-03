import { pgTable, text, timestamp, boolean, integer, uuid, pgEnum } from 'drizzle-orm/pg-core';

// User Role Enum
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT']);

// Academic Status Enums
export const schoolYearStatusEnum = pgEnum('school_year_status', ['DRAFT', 'ACTIVE', 'ARCHIVED']);

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
  name: text('name').notNull(), // e.g. 'SY 2024–2025'
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status').default('ACTIVE').notNull(), // DRAFT | ACTIVE | ARCHIVED
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gradeLevels = pgTable('grade_levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g. 'Grade 10'
  code: text('code').notNull(), // e.g. 'G10'
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
  name: text('name').notNull(), // e.g. 'Section A'
  code: text('code').notNull(), // e.g. 'G10-A'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
