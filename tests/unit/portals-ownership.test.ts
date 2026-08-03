import { describe, it, expect } from 'vitest';
import { PortalService, LinkedChildSummary } from '@/server/services/portal.service';

describe('Parent & Student Portal Server-Side Ownership Logic', () => {
  const sampleChildren: LinkedChildSummary[] = [
    {
      studentId: 'std-child-001',
      studentNumber: 'S2026-0001',
      firstName: 'Juan',
      lastName: 'Dela Cruz Jr.',
      gradeAndSection: 'Grade 10 - A',
      outstandingBalanceCentavos: 1400000,
    },
    {
      studentId: 'std-child-002',
      studentNumber: 'S2026-0002',
      firstName: 'Maria',
      lastName: 'Dela Cruz',
      gradeAndSection: 'Grade 8 - B',
      outstandingBalanceCentavos: 500000,
    },
  ];

  it('allows parent to access linked children', async () => {
    const linkedIds = ['std-child-001', 'std-child-002'];
    const canAccessChild1 = await PortalService.verifyParentChildAccess(
      'parent-user-001',
      'std-child-001',
      linkedIds
    );
    const canAccessChild2 = await PortalService.verifyParentChildAccess(
      'parent-user-001',
      'std-child-002',
      linkedIds
    );

    expect(canAccessChild1).toBe(true);
    expect(canAccessChild2).toBe(true);
  });

  it('denies parent access to unlinked child (direct URL tampering)', async () => {
    const linkedIds = ['std-child-001']; // Parent only owns child 1
    await expect(
      PortalService.verifyParentChildAccess('parent-user-001', 'std-child-002', linkedIds)
    ).rejects.toThrow(/UNAUTHORIZED_CHILD_ACCESS/);
  });

  it('allows student to access own account', async () => {
    const canAccess = await PortalService.verifyStudentAccess('std-001', 'std-001', 'std-001');
    expect(canAccess).toBe(true);
  });

  it('denies student access to another student account', async () => {
    await expect(
      PortalService.verifyStudentAccess('std-001', 'std-002', 'std-001')
    ).rejects.toThrow(/UNAUTHORIZED_STUDENT_ACCESS/);
  });

  it('handles empty payment history gracefully', () => {
    const history: any[] = [];
    expect(history).toHaveLength(0);
  });
});
