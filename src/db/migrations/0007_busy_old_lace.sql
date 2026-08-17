ALTER TABLE "payment_submissions" ADD COLUMN "destination_account_name" text;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD COLUMN "destination_account_number" text;--> statement-breakpoint
-- Normalize legacy rows before enforcing the terminal-state lifecycle contract.
UPDATE "payment_submissions"
SET "reviewed_by_user_id" = COALESCE("reviewed_by_user_id", "submitted_by_user_id"),
    "reviewed_at" = COALESCE("reviewed_at", "updated_at")
WHERE "status" IN ('APPROVED', 'REJECTED');--> statement-breakpoint
UPDATE "payment_submissions"
SET "reviewed_by_user_id" = NULL,
    "reviewed_at" = NULL,
    "rejection_reason" = NULL,
    "approved_payment_id" = NULL
WHERE "status" = 'PENDING_VERIFICATION';--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_destination_snapshot_consistent" CHECK (("payment_submissions"."destination_account_name" IS NULL AND "payment_submissions"."destination_account_number" IS NULL) OR ("payment_submissions"."destination_account_name" IS NOT NULL AND length(trim("payment_submissions"."destination_account_name")) > 0 AND "payment_submissions"."destination_account_number" IS NOT NULL AND length(trim("payment_submissions"."destination_account_number")) > 0));--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_lifecycle_consistent" CHECK (("payment_submissions"."status" = 'PENDING_VERIFICATION' AND "payment_submissions"."reviewed_by_user_id" IS NULL AND "payment_submissions"."reviewed_at" IS NULL AND "payment_submissions"."rejection_reason" IS NULL AND "payment_submissions"."approved_payment_id" IS NULL) OR ("payment_submissions"."status" = 'APPROVED' AND "payment_submissions"."reviewed_by_user_id" IS NOT NULL AND "payment_submissions"."reviewed_at" IS NOT NULL AND "payment_submissions"."rejection_reason" IS NULL AND "payment_submissions"."approved_payment_id" IS NOT NULL) OR ("payment_submissions"."status" = 'REJECTED' AND "payment_submissions"."reviewed_by_user_id" IS NOT NULL AND "payment_submissions"."reviewed_at" IS NOT NULL AND "payment_submissions"."rejection_reason" IS NOT NULL AND length(trim("payment_submissions"."rejection_reason")) > 0 AND "payment_submissions"."approved_payment_id" IS NULL));
