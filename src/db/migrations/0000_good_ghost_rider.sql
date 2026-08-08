CREATE TYPE "public"."adjustment_type" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."assessment_period" AS ENUM('ANNUAL', 'SEMESTER', 'TRIMESTER', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('DRAFT', 'POSTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."fee_category_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."fee_structure_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('ASSESSMENT', 'PAYMENT', 'REVERSAL', 'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."mock_callback_event_type" AS ENUM('PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_PENDING');--> statement-breakpoint
CREATE TYPE "public"."mock_callback_processing_status" AS ENUM('RECEIVED', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."mock_checkout_status" AS ENUM('CREATED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'CONSOLE');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'RETRYING');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ASSESSMENT_POSTED', 'PAYMENT_SUCCESSFUL', 'RECEIPT_AVAILABLE', 'PAYMENT_REVERSED', 'DUE_REMINDER');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK_DEPOSIT', 'MOCK_ONLINE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'POSTED', 'FAILED', 'CANCELLED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."receipt_status" AS ENUM('ACTIVE', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."school_year_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('ACTIVE', 'INACTIVE', 'WITHDRAWN', 'GRADUATED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"type" "adjustment_type" NOT NULL,
	"amount_centavos" integer NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjustments_amount_positive" CHECK ("adjustments"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"fee_category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_centavos" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_items_amount_positive" CHECK ("assessment_items"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"status" "fee_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fee_structure_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_structure_id" uuid NOT NULL,
	"fee_category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_centavos" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_structure_items_amount_positive" CHECK ("fee_structure_items"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"assessment_period" "assessment_period" DEFAULT 'ANNUAL' NOT NULL,
	"name" text NOT NULL,
	"status" "fee_structure_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"relationship" text DEFAULT 'Parent' NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"debit_centavos" integer DEFAULT 0 NOT NULL,
	"credit_centavos" integer DEFAULT 0 NOT NULL,
	"balance_centavos" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amounts_non_negative" CHECK ("ledger_entries"."debit_centavos" >= 0 AND "ledger_entries"."credit_centavos" >= 0 AND "ledger_entries"."balance_centavos" >= 0),
	CONSTRAINT "ledger_entries_one_sided_amount" CHECK (("ledger_entries"."debit_centavos" > 0 AND "ledger_entries"."credit_centavos" = 0) OR ("ledger_entries"."debit_centavos" = 0 AND "ledger_entries"."credit_centavos" > 0))
);
--> statement-breakpoint
CREATE TABLE "mock_payment_callback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"event_type" "mock_callback_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"processing_status" "mock_callback_processing_status" DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	CONSTRAINT "mock_payment_callback_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "mock_payment_callback_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "mock_payment_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"payment_id" uuid,
	"amount_centavos" integer NOT NULL,
	"status" "mock_checkout_status" DEFAULT 'CREATED' NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mock_payment_checkouts_checkout_reference_unique" UNIQUE("checkout_reference"),
	CONSTRAINT "mock_payment_checkouts_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "mock_payment_checkouts_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "mock_payment_checkouts_amount_positive" CHECK ("mock_payment_checkouts"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_attempt_count_non_negative" CHECK ("notification_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"type" "notification_type" NOT NULL,
	"dedupe_key" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"assessment_item_id" uuid NOT NULL,
	"amount_centavos" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reversed_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"amount_centavos" integer NOT NULL,
	"payment_method" "payment_method" DEFAULT 'CASH' NOT NULL,
	"reference_number" text,
	"idempotency_key" text NOT NULL,
	"status" "payment_status" DEFAULT 'POSTED' NOT NULL,
	"processed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_number_unique" UNIQUE("reference_number"),
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"verification_identifier" text NOT NULL,
	"status" "receipt_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "receipts_verification_identifier_unique" UNIQUE("verification_identifier")
);
--> statement-breakpoint
CREATE TABLE "school_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_name" text DEFAULT 'Online School Fees System' NOT NULL,
	"short_name" text DEFAULT 'OSFS' NOT NULL,
	"address" text DEFAULT '123 Education Way, Manila, Philippines' NOT NULL,
	"email" text DEFAULT 'info@schoolfees.example.com' NOT NULL,
	"phone" text DEFAULT '+63 (2) 8123-4567' NOT NULL,
	"logo_url" text,
	"receipt_prefix" text DEFAULT 'OSFS' NOT NULL,
	"currency_code" text DEFAULT 'PHP' NOT NULL,
	"timezone" text DEFAULT 'Asia/Manila' NOT NULL,
	"student_portal_enabled" boolean DEFAULT true NOT NULL,
	"active_school_year_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" "school_year_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"fee_structure_id" uuid NOT NULL,
	"assessment_period" "assessment_period" DEFAULT 'ANNUAL' NOT NULL,
	"total_amount_centavos" integer NOT NULL,
	"status" "assessment_status" DEFAULT 'POSTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_assessments_amount_positive" CHECK ("student_assessments"."total_amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"grade_level_id" uuid,
	"section_id" uuid,
	"school_year_id" uuid,
	"status" "student_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_number_unique" UNIQUE("student_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_assessment_id_student_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."student_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_student_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."student_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_category_id_fee_categories_id_fk" FOREIGN KEY ("fee_category_id") REFERENCES "public"."fee_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_fee_category_id_fee_categories_id_fk" FOREIGN KEY ("fee_category_id") REFERENCES "public"."fee_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_assessment_id_student_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."student_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_payment_callback_events" ADD CONSTRAINT "mock_payment_callback_events_checkout_id_mock_payment_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."mock_payment_checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_payment_checkouts" ADD CONSTRAINT "mock_payment_checkouts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_payment_checkouts" ADD CONSTRAINT "mock_payment_checkouts_assessment_id_student_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."student_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_payment_checkouts" ADD CONSTRAINT "mock_payment_checkouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_assessment_item_id_assessment_items_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_reversed_by_user_id_users_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_assessment_id_student_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."student_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_active_school_year_id_school_years_id_fk" FOREIGN KEY ("active_school_year_id") REFERENCES "public"."school_years"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "adjustments_assessment_idx" ON "adjustments" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "adjustments_student_idx" ON "adjustments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessment_items_assessment_idx" ON "assessment_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fee_categories_status_idx" ON "fee_categories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structure_items_structure_category_unique" ON "fee_structure_items" USING btree ("fee_structure_id","fee_category_id");--> statement-breakpoint
CREATE INDEX "fee_structure_items_structure_idx" ON "fee_structure_items" USING btree ("fee_structure_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structures_scope_name_unique" ON "fee_structures" USING btree ("school_year_id","grade_level_id","assessment_period","name");--> statement-breakpoint
CREATE INDEX "fee_structures_scope_idx" ON "fee_structures" USING btree ("school_year_id","grade_level_id","assessment_period","status");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_levels_code_unique" ON "grade_levels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "grade_levels_display_order_idx" ON "grade_levels" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_students_guardian_student_unique" ON "guardian_students" USING btree ("guardian_id","student_id");--> statement-breakpoint
CREATE INDEX "guardian_students_guardian_idx" ON "guardian_students" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "guardian_students_student_idx" ON "guardian_students" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_user_unique" ON "guardians" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guardians_email_idx" ON "guardians" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ledger_entries_student_created_idx" ON "ledger_entries" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_assessment_idx" ON "ledger_entries" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "mock_payment_callback_events_checkout_idx" ON "mock_payment_callback_events" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "mock_payment_callback_events_status_received_idx" ON "mock_payment_callback_events" USING btree ("processing_status","received_at");--> statement-breakpoint
CREATE INDEX "mock_payment_checkouts_student_status_created_idx" ON "mock_payment_checkouts" USING btree ("student_id","status","created_at");--> statement-breakpoint
CREATE INDEX "mock_payment_checkouts_assessment_idx" ON "mock_payment_checkouts" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_unique" ON "notification_deliveries" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_next_attempt_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_payment_item_unique" ON "payment_allocations" USING btree ("payment_id","assessment_item_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_assessment_item_idx" ON "payment_allocations" USING btree ("assessment_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reversals_payment_unique" ON "payment_reversals" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_student_status_created_idx" ON "payments" USING btree ("student_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payments_assessment_idx" ON "payments" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_unique" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_years_name_unique" ON "school_years" USING btree ("name");--> statement-breakpoint
CREATE INDEX "school_years_status_idx" ON "school_years" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_school_year_code_unique" ON "sections" USING btree ("school_year_id","code");--> statement-breakpoint
CREATE INDEX "sections_school_year_idx" ON "sections" USING btree ("school_year_id");--> statement-breakpoint
CREATE INDEX "sections_grade_level_idx" ON "sections" USING btree ("grade_level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_assessments_scope_unique" ON "student_assessments" USING btree ("student_id","school_year_id","assessment_period");--> statement-breakpoint
CREATE INDEX "student_assessments_student_status_idx" ON "student_assessments" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "students_user_unique" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "students_last_name_first_name_idx" ON "students" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "students_email_idx" ON "students" USING btree ("email");--> statement-breakpoint
CREATE INDEX "students_school_year_idx" ON "students" USING btree ("school_year_id");