ALTER TABLE "payment_allocations" ALTER COLUMN "assessment_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_payment_checkouts" ADD COLUMN "payment_channel" text DEFAULT 'GCash' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "adjustment_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_adjustment_id_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH "ranked_primary_guardians" AS (
  SELECT "id", row_number() OVER (PARTITION BY "student_id" ORDER BY "created_at", "id") AS "row_number"
  FROM "guardian_students"
  WHERE "is_primary" = true
)
UPDATE "guardian_students"
SET "is_primary" = false
WHERE "id" IN (
  SELECT "id"
  FROM "ranked_primary_guardians"
  WHERE "row_number" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_students_student_primary_unique" ON "guardian_students" USING btree ("student_id") WHERE "guardian_students"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_payment_adjustment_unique" ON "payment_allocations" USING btree ("payment_id","adjustment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_adjustment_idx" ON "payment_allocations" USING btree ("adjustment_id");--> statement-breakpoint
ALTER TABLE "mock_payment_checkouts" ADD CONSTRAINT "mock_payment_checkouts_payment_channel_valid" CHECK ("mock_payment_checkouts"."payment_channel" IN ('GCash', 'Maya', 'CreditCard'));--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_exactly_one_target" CHECK (("payment_allocations"."assessment_item_id" IS NOT NULL AND "payment_allocations"."adjustment_id" IS NULL) OR ("payment_allocations"."assessment_item_id" IS NULL AND "payment_allocations"."adjustment_id" IS NOT NULL));
