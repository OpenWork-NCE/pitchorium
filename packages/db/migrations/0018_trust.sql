CREATE TABLE "trust"."activity" (
	"source_event_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust"."appeals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"decision_id" uuid NOT NULL,
	"appellant_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"status" text NOT NULL,
	"reviewer_id" uuid,
	"outcome_statement" text,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trust"."assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"moderator_id" uuid,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust"."cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"subject_id" uuid,
	"origin" text NOT NULL,
	"signal_kind" text,
	"status" text NOT NULL,
	"priority" integer NOT NULL,
	"priority_reasons" text[] NOT NULL,
	"report_count" integer NOT NULL,
	"reasons" text[] NOT NULL,
	"funding_active" boolean NOT NULL,
	"assigned_to" uuid,
	"decision_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trust"."decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"subject_id" uuid,
	"kind" text NOT NULL,
	"reason" text,
	"statement" text NOT NULL,
	"ground" text NOT NULL,
	"ground_reference" text,
	"automated_detection" boolean NOT NULL,
	"suspension_ends_at" timestamp with time zone,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"appealable_until" timestamp with time zone,
	"reverted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trust"."reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"reporter_id" uuid,
	"reporter_name" text,
	"reporter_email" text,
	"message_context" jsonb,
	"outcome" text,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trust"."suspensions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	"lift_statement" text,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects"."projects" ADD COLUMN "funding_frozen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trust"."appeals" ADD CONSTRAINT "appeals_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "trust"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust"."assignments" ADD CONSTRAINT "assignments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "trust"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust"."decisions" ADD CONSTRAINT "decisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "trust"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust"."reports" ADD CONSTRAINT "reports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "trust"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust"."suspensions" ADD CONSTRAINT "suspensions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "trust"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_user_kind_idx" ON "trust"."activity" USING btree ("user_id","kind","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_decision_id_uq" ON "trust"."appeals" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "appeals_pending_idx" ON "trust"."appeals" USING btree ("created_at") WHERE "trust"."appeals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "assignments_case_id_idx" ON "trust"."assignments" USING btree ("case_id","assigned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_open_target_uq" ON "trust"."cases" USING btree ("target_type","target_id") WHERE "trust"."cases"."status" = 'open';--> statement-breakpoint
CREATE INDEX "cases_queue_idx" ON "trust"."cases" USING btree ("priority" DESC NULLS LAST,"created_at","id") WHERE "trust"."cases"."status" = 'open';--> statement-breakpoint
CREATE INDEX "cases_subject_id_idx" ON "trust"."cases" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "cases_created_at_idx" ON "trust"."cases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "decisions_subject_id_idx" ON "trust"."decisions" USING btree ("subject_id","decided_at");--> statement-breakpoint
CREATE INDEX "decisions_case_id_idx" ON "trust"."decisions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "decisions_decided_at_idx" ON "trust"."decisions" USING btree ("decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_case_reporter_uq" ON "trust"."reports" USING btree ("case_id","reporter_id") WHERE "trust"."reports"."reporter_id" is not null;--> statement-breakpoint
CREATE INDEX "reports_case_id_idx" ON "trust"."reports" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_idx" ON "trust"."reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "trust"."reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "suspensions_user_id_idx" ON "trust"."suspensions" USING btree ("user_id") WHERE "trust"."suspensions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "suspensions_ends_at_idx" ON "trust"."suspensions" USING btree ("ends_at") WHERE "trust"."suspensions"."ended_at" is null and "trust"."suspensions"."ends_at" is not null;