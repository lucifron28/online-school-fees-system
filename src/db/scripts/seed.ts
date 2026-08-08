import { DatabaseInstance, getDb } from '../index';
import * as schema from '../schema';
import dotenv from 'dotenv';
import path from 'path';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function hashPassword(password: string): string {
  const salt = 'osfs-demo-salt-2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export async function seedDemoData(db: DatabaseInstance = getDb()) {
  console.log('🌱 Seeding demo database...');

  // 1. Institution Settings
  const existingSettings = await db.select().from(schema.schoolSettings).limit(1);
  let activeSchoolYearId: string | null = null;

  // 2. School Year
  const existingSy = await db
    .select()
    .from(schema.schoolYears)
    .where(eq(schema.schoolYears.name, 'SY 2024–2025'))
    .limit(1);

  if (existingSy.length > 0) {
    activeSchoolYearId = existingSy[0].id;
  } else {
    const [insertedSy] = await db
      .insert(schema.schoolYears)
      .values({
        name: 'SY 2024–2025',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2025-03-31'),
        status: 'ACTIVE',
      })
      .returning();
    activeSchoolYearId = insertedSy.id;
    console.log('  ✔ Created School Year: SY 2024–2025');
  }

  if (existingSettings.length === 0) {
    await db.insert(schema.schoolSettings).values({
      schoolName: 'Online School Fees Monitoring & Payment System',
      shortName: 'OSFS',
      address: '123 Education Way, Manila, Philippines',
      email: 'info@schoolfees.example.com',
      phone: '+63 (2) 8123-4567',
      receiptPrefix: 'OSFS',
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      studentPortalEnabled: true,
      activeSchoolYearId,
    });
    console.log('  ✔ Created Institution Settings');
  }

  // 3. Grade Levels
  const gradesData = [
    { name: 'Grade 7', code: 'G7', displayOrder: 7 },
    { name: 'Grade 8', code: 'G8', displayOrder: 8 },
    { name: 'Grade 9', code: 'G9', displayOrder: 9 },
    { name: 'Grade 10', code: 'G10', displayOrder: 10 },
    { name: 'Grade 11', code: 'G11', displayOrder: 11 },
    { name: 'Grade 12', code: 'G12', displayOrder: 12 },
  ];

  const gradeMap = new Map<string, string>();
  for (const g of gradesData) {
    const existingG = await db
      .select()
      .from(schema.gradeLevels)
      .where(eq(schema.gradeLevels.code, g.code))
      .limit(1);

    if (existingG.length > 0) {
      gradeMap.set(g.code, existingG[0].id);
    } else {
      const [insertedG] = await db.insert(schema.gradeLevels).values(g).returning();
      gradeMap.set(g.code, insertedG.id);
    }
  }
  console.log('  ✔ Seeded Grade Levels (Grade 7 to Grade 12)');

  // 4. Sections
  const g10Id = gradeMap.get('G10');
  if (g10Id && activeSchoolYearId) {
    const existingSec = await db
      .select()
      .from(schema.sections)
      .where(eq(schema.sections.name, 'Section A'))
      .limit(1);

    if (existingSec.length === 0) {
      await db.insert(schema.sections).values({
        gradeLevelId: g10Id,
        schoolYearId: activeSchoolYearId,
        name: 'Section A',
        code: 'G10-A',
      });
      console.log('  ✔ Seeded Section: Grade 10 - Section A');
    }
  }

  // 5. Demo Accounts
  const demoUsers = [
    {
      id: 'usr-admin-demo',
      name: 'System Administrator',
      email: 'admin@demo.school',
      role: 'ADMIN',
    },
    {
      id: 'usr-finance-demo',
      name: 'Finance Staff',
      email: 'finance@demo.school',
      role: 'FINANCE_STAFF',
    },
    {
      id: 'usr-parent-demo',
      name: 'Juan Dela Cruz Sr.',
      email: 'parent@demo.school',
      role: 'PARENT',
    },
    {
      id: 'usr-student-demo',
      name: 'Juan Dela Cruz Jr.',
      email: 'student@demo.school',
      role: 'STUDENT',
    },
  ];

  for (const u of demoUsers) {
    const existingU = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1);
    if (existingU.length === 0) {
      await db.insert(schema.users).values({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: true,
      });

      await db.insert(schema.accounts).values({
        id: `acc-${u.id}`,
        userId: u.id,
        accountId: u.email,
        providerId: 'credential',
        password: hashPassword('DemoPass123!'),
      });
      console.log(`  ✔ Seeded Account: ${u.email} (${u.role})`);
    }
  }

  console.log('✅ Demo seeding completed successfully!');
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
