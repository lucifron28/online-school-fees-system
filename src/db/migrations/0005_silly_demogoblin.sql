CREATE TYPE "public"."announcement_audience" AS ENUM('PARENT', 'STUDENT', 'PARENT_AND_STUDENT');--> statement-breakpoint
CREATE TYPE "public"."announcement_status" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYMENT_DUE_REMINDER';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'ANNOUNCEMENT';--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" "announcement_audience" NOT NULL,
	"status" "announcement_status" DEFAULT 'DRAFT' NOT NULL,
	"publish_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_dates_valid" CHECK ("announcements"."expires_at" IS NULL OR "announcements"."expires_at" > "announcements"."publish_at")
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "default_payment_term_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "reminder_lead_days" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD COLUMN "due_date" date;--> statement-breakpoint
UPDATE "student_assessments"
SET "due_date" = (("created_at" AT TIME ZONE 'Asia/Manila')::date + 7)
WHERE "status" = 'POSTED' AND "due_date" IS NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_status_publish_idx" ON "announcements" USING btree ("status","publish_at");--> statement-breakpoint
CREATE INDEX "announcements_expires_idx" ON "announcements" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "student_assessments_due_date_idx" ON "student_assessments" USING btree ("status","due_date");--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_payment_term_days_valid" CHECK ("school_settings"."default_payment_term_days" BETWEEN 1 AND 365);--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_reminder_lead_days_valid" CHECK ("school_settings"."reminder_lead_days" BETWEEN 0 AND 30);--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_posted_due_date_required" CHECK ("student_assessments"."status" <> 'POSTED' OR "student_assessments"."due_date" IS NOT NULL);
