import { NextResponse } from 'next/server';
import type { AdjustmentPostInput } from '@/lib/assessments';
import { adjustmentPostInputSchema } from '@/lib/assessments';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { AssessmentService, getAssessment } from '@/server/services/assessment.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const assessment = await getAssessment(id);
    const body = adjustmentPostInputSchema.parse(await readJson<AdjustmentPostInput>(request));
    return NextResponse.json(
      await AssessmentService.applyAdjustment({
        assessmentId: assessment.id,
        studentId: assessment.studentId,
        type: body.type,
        amountCentavos: body.amountCentavos,
        reason: body.reason,
        actorUserId: actor.id,
      }),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
