import { asc, and, eq } from 'drizzle-orm';
import { getDb, type DatabaseClient, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { createAuth } from '@/lib/auth/server';
import {
  dateOnlyToUtcDate,
  gradeLevelInputSchema,
  schoolSettingsInputSchema,
  schoolYearInputSchema,
  sectionInputSchema,
  userCreateInputSchema,
  userUpdateInputSchema,
  utcDateToDateOnly,
  type GradeLevelInput,
  type SchoolSettingsInput,
  type SchoolYearInput,
  type SectionInput,
  type UserCreateInput,
  type UserUpdateInput,
} from '@/lib/administration';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors';

const SETTINGS_KEY = 'default';

export async function getOrCreateSchoolSettings(db: DatabaseClient = getDb()) {
  const existing = await db
    .select()
    .from(schema.schoolSettings)
    .where(eq(schema.schoolSettings.singletonKey, SETTINGS_KEY))
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(schema.schoolSettings)
    .values({ singletonKey: SETTINGS_KEY })
    .onConflictDoNothing({ target: schema.schoolSettings.singletonKey })
    .returning();

  if (inserted[0]) return inserted[0];

  const concurrent = await db
    .select()
    .from(schema.schoolSettings)
    .where(eq(schema.schoolSettings.singletonKey, SETTINGS_KEY))
    .limit(1);

  if (!concurrent[0]) {
    throw new AppError('Institution settings could not be initialized.');
  }

  return concurrent[0];
}

export async function getAdministrationSnapshot(db: DatabaseInstance = getDb()) {
  const [settings, schoolYears, gradeLevels, sections] = await Promise.all([
    getOrCreateSchoolSettings(db),
    listSchoolYears(db),
    listGradeLevels(db),
    listSections(db),
  ]);

  return { settings, schoolYears, gradeLevels, sections };
}

export async function isStudentPortalEnabled(db: DatabaseInstance = getDb()) {
  const settings = await db
    .select({ studentPortalEnabled: schema.schoolSettings.studentPortalEnabled })
    .from(schema.schoolSettings)
    .where(eq(schema.schoolSettings.singletonKey, SETTINGS_KEY))
    .limit(1);

  return settings[0]?.studentPortalEnabled ?? true;
}

export async function updateSchoolSettings(
  input: SchoolSettingsInput,
  db: DatabaseInstance = getDb()
) {
  const values = schoolSettingsInputSchema.parse(input);

  if (values.activeSchoolYearId) {
    const activeSchoolYear = await db
      .select({ status: schema.schoolYears.status })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.id, values.activeSchoolYearId))
      .limit(1);

    if (!activeSchoolYear[0]) {
      throw new NotFoundError('The selected school year does not exist.');
    }

    if (activeSchoolYear[0].status !== 'ACTIVE') {
      throw new ValidationError('Only an active school year can be selected.');
    }
  }

  const current = await getOrCreateSchoolSettings(db);
  const [updated] = await db
    .update(schema.schoolSettings)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(schema.schoolSettings.id, current.id))
    .returning();

  if (!updated) throw new AppError('Institution settings could not be saved.');
  return updated;
}

export async function listSchoolYears(db: DatabaseInstance = getDb()) {
  return db.select().from(schema.schoolYears).orderBy(asc(schema.schoolYears.startDate));
}

export async function createSchoolYear(input: SchoolYearInput, db: DatabaseInstance = getDb()) {
  const values = schoolYearInputSchema.parse(input);
  const startDate = dateOnlyToUtcDate(values.startDate);
  const endDate = dateOnlyToUtcDate(values.endDate);

  if (startDate >= endDate) {
    throw new ValidationError('The school-year end date must be after the start date.');
  }

  const existing = await db
    .select({ id: schema.schoolYears.id })
    .from(schema.schoolYears)
    .where(eq(schema.schoolYears.name, values.name))
    .limit(1);

  if (existing[0]) throw new ValidationError('A school year with this name already exists.');

  const [created] = await db
    .insert(schema.schoolYears)
    .values({ name: values.name, startDate, endDate, status: 'DRAFT' })
    .returning();

  return created;
}

export async function updateSchoolYear(
  id: string,
  input: SchoolYearInput,
  db: DatabaseInstance = getDb()
) {
  const values = schoolYearInputSchema.parse(input);
  const startDate = dateOnlyToUtcDate(values.startDate);
  const endDate = dateOnlyToUtcDate(values.endDate);

  if (startDate >= endDate) {
    throw new ValidationError('The school-year end date must be after the start date.');
  }

  const current = await db
    .select({ id: schema.schoolYears.id })
    .from(schema.schoolYears)
    .where(eq(schema.schoolYears.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The school year does not exist.');

  const duplicate = await db
    .select({ id: schema.schoolYears.id })
    .from(schema.schoolYears)
    .where(and(eq(schema.schoolYears.name, values.name), eq(schema.schoolYears.id, id)))
    .limit(1);

  if (!duplicate[0]) {
    const sameName = await db
      .select({ id: schema.schoolYears.id })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.name, values.name))
      .limit(1);
    if (sameName[0] && sameName[0].id !== id) {
      throw new ValidationError('A school year with this name already exists.');
    }
  }

  const [updated] = await db
    .update(schema.schoolYears)
    .set({ name: values.name, startDate, endDate })
    .where(eq(schema.schoolYears.id, id))
    .returning();

  if (!updated) throw new AppError('The school year could not be updated.');
  return updated;
}

export async function activateSchoolYear(id: string, db: DatabaseInstance = getDb()) {
  return db.transaction(async (tx) => {
    const target = await tx
      .select()
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.id, id))
      .limit(1);

    if (!target[0]) throw new NotFoundError('The school year does not exist.');

    await tx
      .update(schema.schoolYears)
      .set({ status: 'ARCHIVED' })
      .where(eq(schema.schoolYears.status, 'ACTIVE'));
    const [active] = await tx
      .update(schema.schoolYears)
      .set({ status: 'ACTIVE' })
      .where(eq(schema.schoolYears.id, id))
      .returning();

    const settings = await tx
      .select({ id: schema.schoolSettings.id })
      .from(schema.schoolSettings)
      .where(eq(schema.schoolSettings.singletonKey, SETTINGS_KEY))
      .limit(1);

    if (settings[0]) {
      await tx
        .update(schema.schoolSettings)
        .set({ activeSchoolYearId: id, updatedAt: new Date() })
        .where(eq(schema.schoolSettings.id, settings[0].id));
    } else {
      await tx.insert(schema.schoolSettings).values({
        singletonKey: SETTINGS_KEY,
        activeSchoolYearId: id,
      });
    }

    return active;
  });
}

export async function listGradeLevels(db: DatabaseInstance = getDb()) {
  return db.select().from(schema.gradeLevels).orderBy(asc(schema.gradeLevels.displayOrder));
}

export async function createGradeLevel(input: GradeLevelInput, db: DatabaseInstance = getDb()) {
  const values = gradeLevelInputSchema.parse(input);
  const existing = await db
    .select({ id: schema.gradeLevels.id })
    .from(schema.gradeLevels)
    .where(eq(schema.gradeLevels.code, values.code))
    .limit(1);

  if (existing[0]) throw new ValidationError('A grade level with this code already exists.');

  const [created] = await db.insert(schema.gradeLevels).values(values).returning();
  return created;
}

export async function updateGradeLevel(
  id: string,
  input: GradeLevelInput,
  db: DatabaseInstance = getDb()
) {
  const values = gradeLevelInputSchema.parse(input);
  const current = await db
    .select({ id: schema.gradeLevels.id })
    .from(schema.gradeLevels)
    .where(eq(schema.gradeLevels.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The grade level does not exist.');

  const duplicate = await db
    .select({ id: schema.gradeLevels.id })
    .from(schema.gradeLevels)
    .where(eq(schema.gradeLevels.code, values.code))
    .limit(1);
  if (duplicate[0] && duplicate[0].id !== id) {
    throw new ValidationError('A grade level with this code already exists.');
  }

  const [updated] = await db
    .update(schema.gradeLevels)
    .set(values)
    .where(eq(schema.gradeLevels.id, id))
    .returning();
  if (!updated) throw new AppError('The grade level could not be updated.');
  return updated;
}

export async function listSections(db: DatabaseInstance = getDb()) {
  return db
    .select({
      id: schema.sections.id,
      gradeLevelId: schema.sections.gradeLevelId,
      schoolYearId: schema.sections.schoolYearId,
      name: schema.sections.name,
      code: schema.sections.code,
      createdAt: schema.sections.createdAt,
    })
    .from(schema.sections)
    .orderBy(asc(schema.sections.schoolYearId), asc(schema.sections.code));
}

export async function createSection(input: SectionInput, db: DatabaseInstance = getDb()) {
  const values = sectionInputSchema.parse(input);
  await assertSectionReferences(values, db);

  const [created] = await db.insert(schema.sections).values(values).returning();
  return created;
}

export async function updateSection(
  id: string,
  input: SectionInput,
  db: DatabaseInstance = getDb()
) {
  const values = sectionInputSchema.parse(input);
  const current = await db
    .select({ id: schema.sections.id })
    .from(schema.sections)
    .where(eq(schema.sections.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The section does not exist.');

  await assertSectionReferences(values, db);
  const [updated] = await db
    .update(schema.sections)
    .set(values)
    .where(eq(schema.sections.id, id))
    .returning();
  if (!updated) throw new AppError('The section could not be updated.');
  return updated;
}

async function assertSectionReferences(input: SectionInput, db: DatabaseInstance) {
  const [gradeLevel, schoolYear] = await Promise.all([
    db
      .select({ id: schema.gradeLevels.id })
      .from(schema.gradeLevels)
      .where(eq(schema.gradeLevels.id, input.gradeLevelId))
      .limit(1),
    db
      .select({ id: schema.schoolYears.id, status: schema.schoolYears.status })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.id, input.schoolYearId))
      .limit(1),
  ]);

  if (!gradeLevel[0]) throw new NotFoundError('The selected grade level does not exist.');
  if (!schoolYear[0]) throw new NotFoundError('The selected school year does not exist.');
  if (schoolYear[0].status === 'ARCHIVED') {
    throw new ValidationError('Sections cannot be added to an archived school year.');
  }
}

export async function listUsers(db: DatabaseInstance = getDb()) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name), asc(schema.users.email));
}

export async function createUser(input: UserCreateInput, db: DatabaseInstance = getDb()) {
  const values = userCreateInputSchema.parse(input);
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, values.email))
    .limit(1);
  if (existing[0]) throw new ValidationError('A user with this email already exists.');

  const adminAuth = createAuth({ allowSignUp: true, database: db });
  let result: Awaited<ReturnType<typeof adminAuth.api.signUpEmail>>;
  try {
    result = await adminAuth.api.signUpEmail({
      body: {
        name: values.name,
        email: values.email,
        password: values.password,
        rememberMe: false,
      },
    });
  } catch {
    throw new ValidationError('The user account could not be created.');
  }

  const [created] = await db
    .update(schema.users)
    .set({ role: values.role, active: true, emailVerified: true })
    .where(eq(schema.users.id, result.user.id))
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      createdAt: schema.users.createdAt,
    });

  if (!created) throw new AppError('The new user account could not be finalized.');
  return created;
}

export async function updateUser(
  id: string,
  actorId: string,
  input: UserUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = userUpdateInputSchema.parse(input);
  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as DatabaseInstance;
    // school_settings is the single shared PostgreSQL serialization row for
    // administrator-role/status mutations. The count and update stay under
    // this lock, so two last-admin decisions cannot both use a stale count.
    const settings = await getOrCreateSchoolSettings(transactionDb);
    await tx
      .select({ id: schema.schoolSettings.id })
      .from(schema.schoolSettings)
      .where(eq(schema.schoolSettings.id, settings.id))
      .for('update')
      .limit(1);

    const existing = await tx.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!existing[0]) throw new NotFoundError('The user account does not exist.');

    const nextRole = values.role ?? existing[0].role;
    const nextActive = values.active ?? existing[0].active;

    if (actorId === id && (nextRole !== 'ADMIN' || !nextActive)) {
      throw new ForbiddenError('You cannot demote or disable your own administrator account.');
    }

    if (
      existing[0].role === 'ADMIN' &&
      existing[0].active &&
      (nextRole !== 'ADMIN' || !nextActive)
    ) {
      const activeAdmins = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.role, 'ADMIN'), eq(schema.users.active, true)));
      if (activeAdmins.length <= 1) {
        throw new ForbiddenError('At least one active administrator must remain.');
      }
    }

    const [updated] = await tx
      .update(schema.users)
      .set({ role: nextRole, active: nextActive, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        active: schema.users.active,
        createdAt: schema.users.createdAt,
      });

    if (!updated) throw new AppError('The user account could not be updated.');
    return updated;
  });
}

export function serializeAdministrationSnapshot(
  snapshot: Awaited<ReturnType<typeof getAdministrationSnapshot>>
) {
  return {
    settings: {
      ...snapshot.settings,
      updatedAt: snapshot.settings.updatedAt.toISOString(),
    },
    schoolYears: snapshot.schoolYears.map((schoolYear) => ({
      ...schoolYear,
      startDate: utcDateToDateOnly(schoolYear.startDate),
      endDate: utcDateToDateOnly(schoolYear.endDate),
      createdAt: schoolYear.createdAt.toISOString(),
    })),
    gradeLevels: snapshot.gradeLevels.map((gradeLevel) => ({
      ...gradeLevel,
      createdAt: gradeLevel.createdAt.toISOString(),
    })),
    sections: snapshot.sections.map((section) => ({
      ...section,
      createdAt: section.createdAt.toISOString(),
    })),
  };
}
