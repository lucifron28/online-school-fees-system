CREATE TYPE "public"."notification_attempt_status" AS ENUM('RETRYING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "notification_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "notification_attempt_status" DEFAULT 'RETRYING' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "notification_delivery_attempts_attempt_number_positive" CHECK ("notification_delivery_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipt_number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prefix" text NOT NULL,
	"year" integer NOT NULL,
	"last_sequence" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_number_sequences_last_sequence_positive" CHECK ("receipt_number_sequences"."last_sequence" > 0)
);
--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_attempts_delivery_number_unique" ON "notification_delivery_attempts" USING btree ("delivery_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_number_sequences_prefix_year_unique" ON "receipt_number_sequences" USING btree ("prefix","year");