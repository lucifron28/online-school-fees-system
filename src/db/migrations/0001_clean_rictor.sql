ALTER TABLE "school_settings" ADD COLUMN "singleton_key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "school_settings_singleton_key_unique" ON "school_settings" USING btree ("singleton_key");--> statement-breakpoint
CREATE UNIQUE INDEX "school_years_single_active_unique" ON "school_years" USING btree ("status") WHERE "school_years"."status" = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_dates_valid" CHECK ("school_years"."start_date" < "school_years"."end_date");