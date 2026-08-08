import { NextResponse } from 'next/server';
import type { AssessmentPostInput } from '@/lib/assessments';
import { assessmentPostInputSchema, assessmentListInputSchema } from '@/lib/assessments';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import {
  AssessmentService,
  getStudentAssessments,
  getStudentLedger,
} from '@/server/services/assessment.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const filters = assessmentListInputSchema.parse({
      status: searchParams.get('status') ?? undefined,
    });
    const [assessments, ledger] = await Promise.all([
      getStudentAssessments(id, filters),
      getStudentLedger(id),
    ]);
    return NextResponse.json({ assessments, ledger });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const body = assessmentPostInputSchema.parse(await readJson<AssessmentPostInput>(request));
    return NextResponse.json(
      await AssessmentService.generateAssessment({
        studentId: id,
        feeStructureId: body.feeStructureId,
        actorUserId: actor.id,
      }),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
