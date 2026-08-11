CREATE TYPE "public"."payment_submission_channel" AS ENUM('GCASH', 'MAYA');--> statement-breakpoint
CREATE TYPE "public"."payment_submission_status" AS ENUM('PENDING_VERIFICATION', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYMENT_PROOF_SUBMITTED' BEFORE 'ANNOUNCEMENT';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYMENT_PROOF_REJECTED' BEFORE 'ANNOUNCEMENT';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'GCASH' BEFORE 'MOCK_ONLINE';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'MAYA' BEFORE 'MOCK_ONLINE';--> statement-breakpoint
CREATE TABLE "payment_submission_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"original_file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_submission_proofs_mime_type_valid" CHECK ("payment_submission_proofs"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "payment_submission_proofs_size_valid" CHECK ("payment_submission_proofs"."size_bytes" BETWEEN 1 AND 3145728 AND octet_length("payment_submission_proofs"."data") BETWEEN 1 AND 3145728),
	CONSTRAINT "payment_submission_proofs_filename_length_valid" CHECK (length(trim("payment_submission_proofs"."original_file_name")) BETWEEN 1 AND 160),
	CONSTRAINT "payment_submission_proofs_sha256_format_valid" CHECK ("payment_submission_proofs"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"submitted_by_user_id" text NOT NULL,
	"payment_channel" "payment_submission_channel" NOT NULL,
	"amount_centavos" integer NOT NULL,
	"reference_number" text NOT NULL,
	"normalized_reference_number" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"status" "payment_submission_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"approved_payment_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_submissions_approved_payment_id_unique" UNIQUE("approved_payment_id"),
	CONSTRAINT "payment_submissions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_submissions_amount_positive" CHECK ("payment_submissions"."amount_centavos" > 0),
	CONSTRAINT "payment_submissions_reference_length_valid" CHECK (length(trim("payment_submissions"."reference_number")) BETWEEN 1 AND 120),
	CONSTRAINT "payment_submissions_rejection_reason_required" CHECK ("payment_submissions"."status" <> 'REJECTED' OR ("payment_submissions"."rejection_reason" IS NOT NULL AND length(trim("payment_submissions"."rejection_reason")) > 0)),
	CONSTRAINT "payment_submissions_approved_payment_required" CHECK ("payment_submissions"."status" <> 'APPROVED' OR "payment_submissions"."approved_payment_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "gcash_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "gcash_account_name" text;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "gcash_account_number" text;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "maya_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "maya_account_name" text;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "maya_account_number" text;--> statement-breakpoint
ALTER TABLE "payment_submission_proofs" ADD CONSTRAINT "payment_submission_proofs_submission_id_payment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."payment_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_approved_payment_id_payments_id_fk" FOREIGN KEY ("approved_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_submission_proofs_submission_unique" ON "payment_submission_proofs" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "payment_submissions_status_channel_created_idx" ON "payment_submissions" USING btree ("status","payment_channel","created_at");--> statement-breakpoint
CREATE INDEX "payment_submissions_student_status_idx" ON "payment_submissions" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "payment_submissions_submitter_created_idx" ON "payment_submissions" USING btree ("submitted_by_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_submissions_active_reference_unique" ON "payment_submissions" USING btree ("payment_channel","normalized_reference_number") WHERE "payment_submissions"."status" IN ('PENDING_VERIFICATION', 'APPROVED');--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_gcash_destination_valid" CHECK ("school_settings"."gcash_enabled" = false OR ("school_settings"."gcash_account_name" IS NOT NULL AND length(trim("school_settings"."gcash_account_name")) > 0 AND "school_settings"."gcash_account_number" IS NOT NULL AND length(trim("school_settings"."gcash_account_number")) > 0));--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_maya_destination_valid" CHECK ("school_settings"."maya_enabled" = false OR ("school_settings"."maya_account_name" IS NOT NULL AND length(trim("school_settings"."maya_account_name")) > 0 AND "school_settings"."maya_account_number" IS NOT NULL AND length(trim("school_settings"."maya_account_number")) > 0));