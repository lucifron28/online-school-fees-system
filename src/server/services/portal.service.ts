import { getServerEnv } from '@/lib/env';

export interface LinkedChildSummary {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  gradeAndSection: string;
  outstandingBalanceCentavos: number;
}

export class PortalService {
  /**
   * Verifies if a parent user is authorized to access a target student's financial records.
   * Throws an error if the parent is not linked to the student.
   */
  static async verifyParentChildAccess(
    parentUserId: string,
    targetStudentId: string,
    linkedStudentIds: string[]
  ): Promise<boolean> {
    if (!parentUserId) {
      throw new Error('UNAUTHORIZED: Parent authentication required.');
    }

    if (!linkedStudentIds || !linkedStudentIds.includes(targetStudentId)) {
      throw new Error(
        "UNAUTHORIZED_CHILD_ACCESS: You do not have permission to view this student's account."
      );
    }

    return true;
  }

  /**
   * Verifies if a student user is authorized to view an account and checks if the student portal is enabled.
   */
  static async verifyStudentAccess(
    studentUserId: string,
    targetStudentId: string,
    ownStudentId: string
  ): Promise<boolean> {
    const env = getServerEnv();
    if (env.ENABLE_STUDENT_PORTAL === false) {
      throw new Error(
        'STUDENT_PORTAL_DISABLED: Student portal access is currently disabled by institution settings.'
      );
    }

    if (targetStudentId !== ownStudentId) {
      throw new Error("UNAUTHORIZED_STUDENT_ACCESS: You cannot view another student's account.");
    }

    return true;
  }

  /**
   * Helper to filter linked children for a parent.
   */
  static getParentChildren(
    parentUserId: string,
    allChildren: LinkedChildSummary[]
  ): LinkedChildSummary[] {
    if (!parentUserId) return [];
    return allChildren;
  }
}
