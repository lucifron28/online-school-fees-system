import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { getDb, type DatabaseClient, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  feeCategoryCreateInputSchema,
  feeCategoryUpdateInputSchema,
  feeStructureCreateInputSchema,
  feeStructureItemInputSchema,
  feeStructureItemUpdateInputSchema,
  feeStructureListInputSchema,
  feeStructureUpdateInputSchema,
  guardianCreateInputSchema,
  guardianListInputSchema,
  guardianStudentLinkInputSchema,
  guardianUpdateInputSchema,
  studentCreateInputSchema,
  studentListInputSchema,
  studentUpdateInputSchema,
  type FeeCategoryCreateInput,
  type FeeCategoryUpdateInput,
  type FeeStructureCreateInput,
  type FeeStructureItemInput,
  type FeeStructureItemUpdateInput,
  type FeeStructureListInput,
  type FeeStructureUpdateInput,
  type GuardianCreateInput,
  type GuardianListInput,
  type GuardianStudentLinkInput,
  type GuardianUpdateInput,
  type StudentCreateInput,
  type StudentListInput,
  type StudentUpdateInput,
} from '@/lib/students-fees';
import { AppError, NotFoundError, ValidationError } from '@/server/errors';

const studentListFields = {
  id: schema.students.id,
  studentNumber: schema.students.studentNumber,
  firstName: schema.students.firstName,
  lastName: schema.students.lastName,
  email: schema.students.email,
  userId: schema.students.userId,
  gradeLevelId: schema.students.gradeLevelId,
  sectionId: schema.students.sectionId,
  schoolYearId: schema.students.schoolYearId,
  status: schema.students.status,
  createdAt: schema.students.createdAt,
  updatedAt: schema.students.updatedAt,
  gradeLevelName: schema.gradeLevels.name,
  gradeLevelCode: schema.gradeLevels.code,
  sectionName: schema.sections.name,
  sectionCode: schema.sections.code,
  schoolYearName: schema.schoolYears.name,
};

const guardianFields = {
  id: schema.guardians.id,
  userId: schema.guardians.userId,
  firstName: schema.guardians.firstName,
  lastName: schema.guardians.lastName,
  email: schema.guardians.email,
  phone: schema.guardians.phone,
  relationship: schema.guardians.relationship,
  address: schema.guardians.address,
  createdAt: schema.guardians.createdAt,
  updatedAt: schema.guardians.updatedAt,
};

const feeStructureFields = {
  id: schema.feeStructures.id,
  schoolYearId: schema.feeStructures.schoolYearId,
  gradeLevelId: schema.feeStructures.gradeLevelId,
  assessmentPeriod: schema.feeStructures.assessmentPeriod,
  name: schema.feeStructures.name,
  status: schema.feeStructures.status,
  createdAt: schema.feeStructures.createdAt,
  updatedAt: schema.feeStructures.updatedAt,
  schoolYearName: schema.schoolYears.name,
  schoolYearStatus: schema.schoolYears.status,
  gradeLevelName: schema.gradeLevels.name,
  gradeLevelCode: schema.gradeLevels.code,
};

const feeStructureItemFields = {
  id: schema.feeStructureItems.id,
  feeStructureId: schema.feeStructureItems.feeStructureId,
  feeCategoryId: schema.feeStructureItems.feeCategoryId,
  name: schema.feeStructureItems.name,
  amountCentavos: schema.feeStructureItems.amountCentavos,
  createdAt: schema.feeStructureItems.createdAt,
  feeCategoryName: schema.feeCategories.name,
  feeCategoryCode: schema.feeCategories.code,
};

function combineConditions(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isUniqueViolation(error: unknown, constraint?: string) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  if (error.code !== '23505') return false;
  return !constraint || !('constraint' in error) || error.constraint === constraint;
}

async function assertUserRole(
  userId: string | null | undefined,
  role: 'PARENT' | 'STUDENT',
  db: DatabaseClient
) {
  if (!userId) return;
  const user = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user[0]) throw new NotFoundError('The selected user account does not exist.');
  if (user[0].role !== role) {
    throw new ValidationError(`Only ${role} accounts can be linked to this record.`);
  }
}

async function selectStudentOutstandingBalances(studentIds: string[], db: DatabaseClient) {
  if (studentIds.length === 0) return new Map<string, number>();
  const entries = await db
    .select({
      studentId: schema.ledgerEntries.studentId,
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
    })
    .from(schema.ledgerEntries)
    .where(inArray(schema.ledgerEntries.studentId, studentIds));
  const balances = new Map<string, number>();
  for (const studentId of studentIds) balances.set(studentId, 0);
  for (const entry of entries) {
    balances.set(
      entry.studentId,
      (balances.get(entry.studentId) ?? 0) + entry.debitCentavos - entry.creditCentavos
    );
  }
  return balances;
}

async function assertStudentReferences(
  input: {
    gradeLevelId: string | null;
    sectionId: string | null;
    schoolYearId: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'GRADUATED';
  },
  db: DatabaseInstance
) {
  if (input.sectionId && (!input.gradeLevelId || !input.schoolYearId)) {
    throw new ValidationError('A section requires both a grade level and a school year.');
  }

  const [gradeLevel, schoolYear, section] = await Promise.all([
    input.gradeLevelId
      ? db
          .select({ id: schema.gradeLevels.id })
          .from(schema.gradeLevels)
          .where(eq(schema.gradeLevels.id, input.gradeLevelId))
          .limit(1)
      : Promise.resolve([]),
    input.schoolYearId
      ? db
          .select({ id: schema.schoolYears.id, status: schema.schoolYears.status })
          .from(schema.schoolYears)
          .where(eq(schema.schoolYears.id, input.schoolYearId))
          .limit(1)
      : Promise.resolve([]),
    input.sectionId
      ? db
          .select({
            id: schema.sections.id,
            gradeLevelId: schema.sections.gradeLevelId,
            schoolYearId: schema.sections.schoolYearId,
          })
          .from(schema.sections)
          .where(eq(schema.sections.id, input.sectionId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (input.gradeLevelId && !gradeLevel[0]) {
    throw new NotFoundError('The selected grade level does not exist.');
  }
  if (input.schoolYearId && !schoolYear[0]) {
    throw new NotFoundError('The selected school year does not exist.');
  }
  if (input.schoolYearId && schoolYear[0]?.status === 'ARCHIVED' && input.status === 'ACTIVE') {
    throw new ValidationError('An active student cannot be assigned to an archived school year.');
  }
  if (input.sectionId && !section[0]) {
    throw new NotFoundError('The selected section does not exist.');
  }
  if (section[0]) {
    if (section[0].gradeLevelId !== input.gradeLevelId) {
      throw new ValidationError('The selected section belongs to a different grade level.');
    }
    if (section[0].schoolYearId !== input.schoolYearId) {
      throw new ValidationError('The selected section belongs to a different school year.');
    }
  }
}

export async function listStudents(
  input: Partial<StudentListInput> = {},
  db: DatabaseInstance = getDb()
) {
  const values = studentListInputSchema.parse(input);
  const filters: SQL[] = [];

  if (values.search) {
    const search = `%${values.search}%`;
    filters.push(
      or(
        ilike(schema.students.studentNumber, search),
        ilike(schema.students.firstName, search),
        ilike(schema.students.lastName, search),
        ilike(schema.students.email, search)
      ) as SQL
    );
  }
  if (values.status) filters.push(eq(schema.students.status, values.status));
  if (values.gradeLevelId) filters.push(eq(schema.students.gradeLevelId, values.gradeLevelId));
  if (values.schoolYearId) filters.push(eq(schema.students.schoolYearId, values.schoolYearId));

  const where = combineConditions(filters);
  const offset = (values.page - 1) * values.pageSize;
  const sortColumn =
    values.sort === 'studentNumber'
      ? schema.students.studentNumber
      : values.sort === 'firstName'
        ? schema.students.firstName
        : values.sort === 'status'
          ? schema.students.status
          : schema.students.lastName;
  const sortOrder = values.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);
  const [rows, totalRows] = await Promise.all([
    db
      .select(studentListFields)
      .from(schema.students)
      .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
      .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
      .leftJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.students.schoolYearId))
      .where(where)
      .orderBy(sortOrder, asc(schema.students.firstName))
      .limit(values.pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(schema.students)
      .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
      .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
      .leftJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.students.schoolYearId))
      .where(where),
  ]);

  const balances = await selectStudentOutstandingBalances(
    rows.map((row) => row.id),
    db
  );
  return {
    data: rows.map((row) => ({
      ...row,
      outstandingBalanceCentavos: balances.get(row.id) ?? 0,
    })),
    pagination: {
      page: values.page,
      pageSize: values.pageSize,
      total: Number(totalRows[0]?.count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(totalRows[0]?.count ?? 0) / values.pageSize)),
    },
  };
}

async function selectStudent(id: string, db: DatabaseInstance) {
  const rows = await db
    .select(studentListFields)
    .from(schema.students)
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
    .leftJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.students.schoolYearId))
    .where(eq(schema.students.id, id))
    .limit(1);

  if (!rows[0]) throw new NotFoundError('The student record does not exist.');
  return rows[0];
}

export async function listStudentGuardians(studentId: string, db: DatabaseInstance = getDb()) {
  await selectStudent(studentId, db);
  return db
    .select({
      id: schema.guardians.id,
      userId: schema.guardians.userId,
      firstName: schema.guardians.firstName,
      lastName: schema.guardians.lastName,
      email: schema.guardians.email,
      phone: schema.guardians.phone,
      relationship: schema.guardians.relationship,
      address: schema.guardians.address,
      linkId: schema.guardianStudents.id,
      isPrimary: schema.guardianStudents.isPrimary,
      linkedAt: schema.guardianStudents.createdAt,
    })
    .from(schema.guardianStudents)
    .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
    .where(eq(schema.guardianStudents.studentId, studentId))
    .orderBy(asc(schema.guardians.lastName), asc(schema.guardians.firstName));
}

export async function getStudent(id: string, db: DatabaseInstance = getDb()) {
  const student = await selectStudent(id, db);
  const guardians = await listStudentGuardians(id, db);
  return { ...student, guardians };
}

export async function createStudent(input: StudentCreateInput, db: DatabaseInstance = getDb()) {
  const values = studentCreateInputSchema.parse(input);
  const duplicate = await db
    .select({ id: schema.students.id })
    .from(schema.students)
    .where(eq(schema.students.studentNumber, values.studentNumber))
    .limit(1);

  if (duplicate[0]) throw new ValidationError('A student with this student number already exists.');
  await assertUserRole(values.userId, 'STUDENT', db);
  await assertStudentReferences(values, db);

  const [created] = await db.insert(schema.students).values(values).returning();
  if (!created) throw new AppError('The student record could not be created.');
  return getStudent(created.id, db);
}

export async function updateStudent(
  id: string,
  input: StudentUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = studentUpdateInputSchema.parse(input);
  const current = await db
    .select()
    .from(schema.students)
    .where(eq(schema.students.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The student record does not exist.');

  const next = {
    studentNumber: values.studentNumber ?? current[0].studentNumber,
    firstName: values.firstName ?? current[0].firstName,
    lastName: values.lastName ?? current[0].lastName,
    email: values.email ?? current[0].email,
    userId: values.userId !== undefined ? values.userId : current[0].userId,
    gradeLevelId: values.gradeLevelId !== undefined ? values.gradeLevelId : current[0].gradeLevelId,
    sectionId: values.sectionId !== undefined ? values.sectionId : current[0].sectionId,
    schoolYearId: values.schoolYearId !== undefined ? values.schoolYearId : current[0].schoolYearId,
    status: values.status ?? current[0].status,
  };

  if (
    next.studentNumber !== current[0].studentNumber &&
    (
      await db
        .select({ id: schema.students.id })
        .from(schema.students)
        .where(eq(schema.students.studentNumber, next.studentNumber))
        .limit(1)
    )[0]
  ) {
    throw new ValidationError('A student with this student number already exists.');
  }
  await assertUserRole(next.userId, 'STUDENT', db);
  await assertStudentReferences(next, db);

  const [updated] = await db
    .update(schema.students)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(schema.students.id, id))
    .returning();
  if (!updated) throw new AppError('The student record could not be updated.');
  return getStudent(updated.id, db);
}

export async function listGuardians(input: GuardianListInput = {}, db: DatabaseInstance = getDb()) {
  const values = guardianListInputSchema.parse(input);
  const filters: SQL[] = [];
  if (values.search) {
    const search = `%${values.search}%`;
    filters.push(
      or(
        ilike(schema.guardians.firstName, search),
        ilike(schema.guardians.lastName, search),
        ilike(schema.guardians.email, search),
        ilike(schema.guardians.phone, search)
      ) as SQL
    );
  }
  if (values.studentId) filters.push(eq(schema.guardianStudents.studentId, values.studentId));
  const where = combineConditions(filters);

  const query = db
    .select({
      ...guardianFields,
      linkedStudentCount: count(schema.guardianStudents.id),
    })
    .from(schema.guardians)
    .leftJoin(schema.guardianStudents, eq(schema.guardianStudents.guardianId, schema.guardians.id))
    .where(where)
    .groupBy(
      schema.guardians.id,
      schema.guardians.userId,
      schema.guardians.firstName,
      schema.guardians.lastName,
      schema.guardians.email,
      schema.guardians.phone,
      schema.guardians.relationship,
      schema.guardians.address,
      schema.guardians.createdAt,
      schema.guardians.updatedAt
    )
    .orderBy(asc(schema.guardians.lastName), asc(schema.guardians.firstName));

  return query;
}

async function selectGuardian(id: string, db: DatabaseClient) {
  const rows = await db
    .select(guardianFields)
    .from(schema.guardians)
    .where(eq(schema.guardians.id, id))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The guardian record does not exist.');
  return rows[0];
}

export async function listGuardianStudents(guardianId: string, db: DatabaseInstance = getDb()) {
  await selectGuardian(guardianId, db);
  return db
    .select({
      id: schema.students.id,
      studentNumber: schema.students.studentNumber,
      firstName: schema.students.firstName,
      lastName: schema.students.lastName,
      status: schema.students.status,
      linkId: schema.guardianStudents.id,
      isPrimary: schema.guardianStudents.isPrimary,
      linkedAt: schema.guardianStudents.createdAt,
    })
    .from(schema.guardianStudents)
    .innerJoin(schema.students, eq(schema.students.id, schema.guardianStudents.studentId))
    .where(eq(schema.guardianStudents.guardianId, guardianId))
    .orderBy(asc(schema.students.lastName), asc(schema.students.firstName));
}

export async function getGuardian(id: string, db: DatabaseInstance = getDb()) {
  const guardian = await selectGuardian(id, db);
  const students = await listGuardianStudents(id, db);
  return { ...guardian, students };
}

export async function createGuardian(input: GuardianCreateInput, db: DatabaseInstance = getDb()) {
  const values = guardianCreateInputSchema.parse(input);
  await assertUserRole(values.userId, 'PARENT', db);
  const [created] = await db.insert(schema.guardians).values(values).returning();
  if (!created) throw new AppError('The guardian record could not be created.');
  return getGuardian(created.id, db);
}

export async function updateGuardian(
  id: string,
  input: GuardianUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = guardianUpdateInputSchema.parse(input);
  const current = await db
    .select()
    .from(schema.guardians)
    .where(eq(schema.guardians.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The guardian record does not exist.');

  const next = {
    firstName: values.firstName ?? current[0].firstName,
    lastName: values.lastName ?? current[0].lastName,
    email: values.email ?? current[0].email,
    phone: values.phone ?? current[0].phone,
    relationship: values.relationship ?? current[0].relationship,
    address: values.address ?? current[0].address,
    userId: values.userId !== undefined ? values.userId : current[0].userId,
  };
  await assertUserRole(next.userId, 'PARENT', db);

  const [updated] = await db
    .update(schema.guardians)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(schema.guardians.id, id))
    .returning();
  if (!updated) throw new AppError('The guardian record could not be updated.');
  return getGuardian(updated.id, db);
}

export async function linkGuardianStudent(
  input: GuardianStudentLinkInput,
  db: DatabaseInstance = getDb()
) {
  const values = guardianStudentLinkInputSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      await selectGuardian(values.guardianId, tx);
      await tx
        .select({ id: schema.students.id })
        .from(schema.students)
        .where(eq(schema.students.id, values.studentId))
        .for('update')
        .limit(1)
        .then((rows) => {
          if (!rows[0]) throw new NotFoundError('The student record does not exist.');
        });
      const existing = await tx
        .select({ id: schema.guardianStudents.id })
        .from(schema.guardianStudents)
        .where(
          and(
            eq(schema.guardianStudents.guardianId, values.guardianId),
            eq(schema.guardianStudents.studentId, values.studentId)
          )
        )
        .limit(1);
      if (existing[0]) throw new ValidationError('This guardian is already linked to the student.');

      if (values.isPrimary) {
        await tx
          .update(schema.guardianStudents)
          .set({ isPrimary: false })
          .where(eq(schema.guardianStudents.studentId, values.studentId));
      }
      const [created] = await tx.insert(schema.guardianStudents).values(values).returning();
      if (!created) throw new AppError('The guardian-student link could not be created.');
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'guardian_students_student_primary_unique')) {
      throw new ValidationError('The student already has a primary guardian.');
    }
    if (isUniqueViolation(error, 'guardian_students_guardian_student_unique')) {
      throw new ValidationError('This guardian is already linked to the student.');
    }
    throw error;
  }
}

export async function unlinkGuardianStudent(
  guardianId: string,
  studentId: string,
  db: DatabaseInstance = getDb()
) {
  const link = await db
    .select({ id: schema.guardianStudents.id })
    .from(schema.guardianStudents)
    .where(
      and(
        eq(schema.guardianStudents.guardianId, guardianId),
        eq(schema.guardianStudents.studentId, studentId)
      )
    )
    .limit(1);
  if (!link[0]) throw new NotFoundError('The guardian-student link does not exist.');

  const [deleted] = await db
    .delete(schema.guardianStudents)
    .where(eq(schema.guardianStudents.id, link[0].id))
    .returning({ id: schema.guardianStudents.id });
  if (!deleted) throw new AppError('The guardian-student link could not be removed.');
  return { deleted: true };
}

export async function listFeeCategories(db: DatabaseInstance = getDb()) {
  return db.select().from(schema.feeCategories).orderBy(asc(schema.feeCategories.name));
}

export async function createFeeCategory(
  input: FeeCategoryCreateInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeCategoryCreateInputSchema.parse(input);
  const duplicate = await db
    .select({ id: schema.feeCategories.id })
    .from(schema.feeCategories)
    .where(eq(schema.feeCategories.code, values.code))
    .limit(1);
  if (duplicate[0]) throw new ValidationError('A fee category with this code already exists.');

  const [created] = await db.insert(schema.feeCategories).values(values).returning();
  if (!created) throw new AppError('The fee category could not be created.');
  return created;
}

export async function updateFeeCategory(
  id: string,
  input: FeeCategoryUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeCategoryUpdateInputSchema.parse(input);
  const current = await db
    .select()
    .from(schema.feeCategories)
    .where(eq(schema.feeCategories.id, id))
    .limit(1);
  if (!current[0]) throw new NotFoundError('The fee category does not exist.');

  const next = {
    name: values.name ?? current[0].name,
    code: values.code ?? current[0].code,
    description: values.description !== undefined ? values.description : current[0].description,
    status: values.status ?? current[0].status,
  };
  if (next.code !== current[0].code) {
    const duplicate = await db
      .select({ id: schema.feeCategories.id })
      .from(schema.feeCategories)
      .where(eq(schema.feeCategories.code, next.code))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== id) {
      throw new ValidationError('A fee category with this code already exists.');
    }
  }

  const [updated] = await db
    .update(schema.feeCategories)
    .set(next)
    .where(eq(schema.feeCategories.id, id))
    .returning();
  if (!updated) throw new AppError('The fee category could not be updated.');
  return updated;
}

async function assertFeeStructureReferences(
  input: {
    schoolYearId: string;
    gradeLevelId: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    items: FeeStructureItemInput[];
  },
  db: DatabaseClient
) {
  const [schoolYear, gradeLevel] = await Promise.all([
    db
      .select({ id: schema.schoolYears.id, status: schema.schoolYears.status })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.id, input.schoolYearId))
      .limit(1),
    db
      .select({ id: schema.gradeLevels.id })
      .from(schema.gradeLevels)
      .where(eq(schema.gradeLevels.id, input.gradeLevelId))
      .limit(1),
  ]);
  if (!schoolYear[0]) throw new NotFoundError('The selected school year does not exist.');
  if (!gradeLevel[0]) throw new NotFoundError('The selected grade level does not exist.');
  if (schoolYear[0].status === 'ARCHIVED') {
    throw new ValidationError('Fee structures cannot be assigned to an archived school year.');
  }
  if (input.status === 'ACTIVE' && schoolYear[0].status !== 'ACTIVE') {
    throw new ValidationError('Only an active school year can have an active fee structure.');
  }

  const categoryIds = input.items.map((item) => item.feeCategoryId);
  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new ValidationError('A fee category can only appear once in a fee structure.');
  }

  const categories = await db
    .select({ id: schema.feeCategories.id, status: schema.feeCategories.status })
    .from(schema.feeCategories)
    .where(inArray(schema.feeCategories.id, categoryIds));
  if (categories.length !== categoryIds.length) {
    throw new NotFoundError('One or more selected fee categories do not exist.');
  }
  if (categories.some((category) => category.status !== 'ACTIVE')) {
    throw new ValidationError('Only active fee categories can be used in a fee structure.');
  }
}

export async function listFeeStructures(
  input: FeeStructureListInput = {},
  db: DatabaseInstance = getDb()
) {
  const values = feeStructureListInputSchema.parse(input);
  const filters: SQL[] = [];
  if (values.schoolYearId) filters.push(eq(schema.feeStructures.schoolYearId, values.schoolYearId));
  if (values.gradeLevelId) filters.push(eq(schema.feeStructures.gradeLevelId, values.gradeLevelId));
  if (values.status) filters.push(eq(schema.feeStructures.status, values.status));
  const where = combineConditions(filters);

  const rows = await db
    .select(feeStructureFields)
    .from(schema.feeStructures)
    .innerJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.feeStructures.schoolYearId))
    .innerJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.feeStructures.gradeLevelId))
    .where(where)
    .orderBy(
      asc(schema.schoolYears.startDate),
      asc(schema.gradeLevels.displayOrder),
      asc(schema.feeStructures.name)
    );

  if (rows.length === 0) return [];
  const items = await db
    .select(feeStructureItemFields)
    .from(schema.feeStructureItems)
    .innerJoin(
      schema.feeCategories,
      eq(schema.feeCategories.id, schema.feeStructureItems.feeCategoryId)
    )
    .where(
      inArray(
        schema.feeStructureItems.feeStructureId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(schema.feeCategories.name));

  const itemsByStructure = new Map<string, typeof items>();
  for (const item of items) {
    const current = itemsByStructure.get(item.feeStructureId) ?? [];
    current.push(item);
    itemsByStructure.set(item.feeStructureId, current);
  }

  return rows.map((row) => ({ ...row, items: itemsByStructure.get(row.id) ?? [] }));
}

async function selectFeeStructure(id: string, db: DatabaseClient) {
  const rows = await db
    .select(feeStructureFields)
    .from(schema.feeStructures)
    .innerJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.feeStructures.schoolYearId))
    .innerJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.feeStructures.gradeLevelId))
    .where(eq(schema.feeStructures.id, id))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The fee structure does not exist.');
  return rows[0];
}

/**
 * Shared fee-structure serialization boundary. Assessment posting acquires
 * this lock after the student lock; every fee-structure mutation acquires it
 * before checking posted assessments or reading mutable definition data.
 */
export async function lockFeeStructureForMutation(id: string, db: DatabaseClient) {
  const rows = await db
    .select()
    .from(schema.feeStructures)
    .where(eq(schema.feeStructures.id, id))
    .for('update')
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The fee structure does not exist.');
  return rows[0];
}

async function selectFeeStructureItems(id: string, db: DatabaseClient) {
  return db
    .select(feeStructureItemFields)
    .from(schema.feeStructureItems)
    .innerJoin(
      schema.feeCategories,
      eq(schema.feeCategories.id, schema.feeStructureItems.feeCategoryId)
    )
    .where(eq(schema.feeStructureItems.feeStructureId, id))
    .orderBy(asc(schema.feeCategories.name));
}

export async function getFeeStructure(id: string, db: DatabaseInstance = getDb()) {
  const structure = await selectFeeStructure(id, db);
  const items = await selectFeeStructureItems(id, db);
  return { ...structure, items };
}

export async function createFeeStructure(
  input: FeeStructureCreateInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeStructureCreateInputSchema.parse(input);
  await assertFeeStructureReferences(values, db);

  return db
    .transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.feeStructures)
        .values({
          schoolYearId: values.schoolYearId,
          gradeLevelId: values.gradeLevelId,
          assessmentPeriod: values.assessmentPeriod,
          name: values.name,
          status: values.status,
        })
        .returning();
      if (!created) throw new AppError('The fee structure could not be created.');
      await tx
        .insert(schema.feeStructureItems)
        .values(values.items.map((item) => ({ ...item, feeStructureId: created.id })));
      return created;
    })
    .then((created) => getFeeStructure(created.id, db));
}

async function hasPostedAssessment(id: string, db: DatabaseClient) {
  const posted = await db
    .select({ id: schema.studentAssessments.id })
    .from(schema.studentAssessments)
    .where(
      and(
        eq(schema.studentAssessments.feeStructureId, id),
        eq(schema.studentAssessments.status, 'POSTED')
      )
    )
    .limit(1);
  return Boolean(posted[0]);
}

export async function updateFeeStructure(
  id: string,
  input: FeeStructureUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeStructureUpdateInputSchema.parse(input);
  const structuralChange =
    hasOwn(values, 'schoolYearId') ||
    hasOwn(values, 'gradeLevelId') ||
    hasOwn(values, 'assessmentPeriod') ||
    hasOwn(values, 'name') ||
    hasOwn(values, 'items');
  const updated = await db.transaction(async (tx) => {
    await lockFeeStructureForMutation(id, tx);
    const current = await selectFeeStructure(id, tx);
    const posted = await hasPostedAssessment(id, tx);
    if (posted && structuralChange) {
      throw new ValidationError(
        'This fee structure has posted assessments and can only be archived; its definition is locked.'
      );
    }
    if (
      posted &&
      values.status &&
      values.status !== 'ARCHIVED' &&
      values.status !== current.status
    ) {
      throw new ValidationError(
        'A fee structure with posted assessments cannot be reactivated or reopened.'
      );
    }

    if (values.status === 'ARCHIVED' && !structuralChange) {
      const [archived] = await tx
        .update(schema.feeStructures)
        .set({ status: 'ARCHIVED', updatedAt: new Date() })
        .where(eq(schema.feeStructures.id, id))
        .returning();
      if (!archived) throw new AppError('The fee structure could not be archived.');
      return archived;
    }

    const next = {
      schoolYearId: values.schoolYearId ?? current.schoolYearId,
      gradeLevelId: values.gradeLevelId ?? current.gradeLevelId,
      assessmentPeriod: values.assessmentPeriod ?? current.assessmentPeriod,
      name: values.name ?? current.name,
      status: values.status ?? current.status,
    };
    const currentItems = await selectFeeStructureItems(id, tx);
    const nextItems =
      values.items ??
      currentItems.map((item) => ({
        feeCategoryId: item.feeCategoryId,
        name: item.name,
        amountCentavos: item.amountCentavos,
      }));
    await assertFeeStructureReferences({ ...next, items: nextItems }, tx);

    const [updatedStructure] = await tx
      .update(schema.feeStructures)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(schema.feeStructures.id, id))
      .returning();
    if (!updatedStructure) throw new AppError('The fee structure could not be updated.');

    if (values.items) {
      await tx
        .delete(schema.feeStructureItems)
        .where(eq(schema.feeStructureItems.feeStructureId, id));
      await tx
        .insert(schema.feeStructureItems)
        .values(nextItems.map((item) => ({ ...item, feeStructureId: id })));
    }
    return updatedStructure;
  });
  return getFeeStructure(updated.id, db);
}

export async function addFeeStructureItem(
  structureId: string,
  input: FeeStructureItemInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeStructureItemInputSchema.parse(input);
  await db.transaction(async (tx) => {
    await lockFeeStructureForMutation(structureId, tx);
    if (await hasPostedAssessment(structureId, tx)) {
      throw new ValidationError(
        'Fee items are locked after an assessment is posted. Archive the structure instead.'
      );
    }
    await assertFeeStructureItemCategory(values.feeCategoryId, tx);
    const [created] = await tx
      .insert(schema.feeStructureItems)
      .values({ ...values, feeStructureId: structureId })
      .returning();
    if (!created) throw new AppError('The fee item could not be created.');
  });
  return getFeeStructure(structureId, db);
}

async function assertFeeStructureItemCategory(categoryId: string, db: DatabaseClient) {
  const category = await db
    .select({ id: schema.feeCategories.id, status: schema.feeCategories.status })
    .from(schema.feeCategories)
    .where(eq(schema.feeCategories.id, categoryId))
    .limit(1);
  if (!category[0]) throw new NotFoundError('The selected fee category does not exist.');
  if (category[0].status !== 'ACTIVE') {
    throw new ValidationError('Only active fee categories can be used in a fee structure.');
  }
}

export async function updateFeeStructureItem(
  structureId: string,
  itemId: string,
  input: FeeStructureItemUpdateInput,
  db: DatabaseInstance = getDb()
) {
  const values = feeStructureItemUpdateInputSchema.parse(input);
  await db.transaction(async (tx) => {
    await lockFeeStructureForMutation(structureId, tx);
    if (await hasPostedAssessment(structureId, tx)) {
      throw new ValidationError(
        'Fee items are locked after an assessment is posted. Archive the structure instead.'
      );
    }
    const current = await tx
      .select()
      .from(schema.feeStructureItems)
      .where(
        and(
          eq(schema.feeStructureItems.id, itemId),
          eq(schema.feeStructureItems.feeStructureId, structureId)
        )
      )
      .limit(1);
    if (!current[0]) throw new NotFoundError('The fee structure item does not exist.');

    const next = {
      feeCategoryId: values.feeCategoryId ?? current[0].feeCategoryId,
      name: values.name ?? current[0].name,
      amountCentavos: values.amountCentavos ?? current[0].amountCentavos,
    };
    await assertFeeStructureItemCategory(next.feeCategoryId, tx);
    const [updated] = await tx
      .update(schema.feeStructureItems)
      .set(next)
      .where(eq(schema.feeStructureItems.id, itemId))
      .returning();
    if (!updated) throw new AppError('The fee structure item could not be updated.');
  });
  return getFeeStructure(structureId, db);
}

export async function listFeeOptions(db: DatabaseInstance = getDb()) {
  const [schoolYears, gradeLevels, feeCategories] = await Promise.all([
    db.select().from(schema.schoolYears).orderBy(asc(schema.schoolYears.startDate)),
    db.select().from(schema.gradeLevels).orderBy(asc(schema.gradeLevels.displayOrder)),
    db
      .select()
      .from(schema.feeCategories)
      .where(eq(schema.feeCategories.status, 'ACTIVE'))
      .orderBy(asc(schema.feeCategories.name)),
  ]);
  return { schoolYears, gradeLevels, feeCategories };
}
