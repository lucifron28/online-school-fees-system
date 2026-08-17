ALTER TABLE "payment_submissions" DROP CONSTRAINT "payment_submissions_lifecycle_consistent";--> statement-breakpoint
-- 0007 attributed terminal legacy rows to the submitter when no reviewer was known.
-- Preserve the terminal status while clearing that unverifiable attribution.
UPDATE "payment_submissions" AS submission
SET "reviewed_by_user_id" = NULL,
    "reviewed_at" = NULL
WHERE "status" IN ('APPROVED', 'REJECTED')
  AND (
    "reviewed_by_user_id" IS NULL
    OR "reviewed_at" IS NULL
    OR "reviewed_by_user_id" = "submitted_by_user_id"
    OR NOT EXISTS (
      SELECT 1
      FROM "users" AS reviewer
      WHERE reviewer."id" = submission."reviewed_by_user_id"
        AND reviewer."role" IN ('ADMIN', 'FINANCE_STAFF')
    )
  );--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_lifecycle_consistent" CHECK (("payment_submissions"."status" = 'PENDING_VERIFICATION' AND "payment_submissions"."reviewed_by_user_id" IS NULL AND "payment_submissions"."reviewed_at" IS NULL AND "payment_submissions"."rejection_reason" IS NULL AND "payment_submissions"."approved_payment_id" IS NULL) OR ("payment_submissions"."status" = 'APPROVED' AND (("payment_submissions"."reviewed_by_user_id" IS NULL AND "payment_submissions"."reviewed_at" IS NULL) OR ("payment_submissions"."reviewed_by_user_id" IS NOT NULL AND "payment_submissions"."reviewed_at" IS NOT NULL)) AND "payment_submissions"."rejection_reason" IS NULL AND "payment_submissions"."approved_payment_id" IS NOT NULL) OR ("payment_submissions"."status" = 'REJECTED' AND (("payment_submissions"."reviewed_by_user_id" IS NULL AND "payment_submissions"."reviewed_at" IS NULL) OR ("payment_submissions"."reviewed_by_user_id" IS NOT NULL AND "payment_submissions"."reviewed_at" IS NOT NULL)) AND "payment_submissions"."rejection_reason" IS NOT NULL AND length(trim("payment_submissions"."rejection_reason")) > 0 AND "payment_submissions"."approved_payment_id" IS NULL));
