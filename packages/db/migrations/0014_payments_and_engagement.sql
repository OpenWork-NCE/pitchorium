CREATE TABLE "payments"."contributions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"organization_id" uuid,
	"holder_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"method" text NOT NULL,
	"country" text,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_session_id" text,
	"provider_payment_id" text,
	"payment_url" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"eur_minor" bigint NOT NULL,
	"rate_units_per_eur" text NOT NULL,
	"rate_source" text NOT NULL,
	"rate_at" timestamp with time zone NOT NULL,
	"commission_minor" bigint NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_version" text NOT NULL,
	"provider_fee_minor" bigint,
	"refunded_minor" bigint NOT NULL,
	"refunded_eur_minor" bigint NOT NULL,
	"commission_refunded_minor" bigint NOT NULL,
	"lost_minor" bigint NOT NULL,
	"lost_eur_minor" bigint NOT NULL,
	"reward_id" uuid,
	"reward_state" text NOT NULL,
	"public_display" boolean NOT NULL,
	"anonymous" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"succeeded_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments"."discrepancies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"kind" text NOT NULL,
	"provider" text,
	"reference" text NOT NULL,
	"contribution_id" uuid,
	"project_id" uuid,
	"expected" text,
	"actual" text,
	"status" text NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "payments"."disputes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"provider_dispute_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"eur_minor" bigint NOT NULL,
	"status" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments"."kyc_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"document_media_ids" uuid[] NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"decision_reason" text
);
--> statement-breakpoint
CREATE TABLE "payments"."ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"contribution_id" uuid,
	"offline_contribution_id" uuid,
	"project_id" uuid NOT NULL,
	"reverses_entry_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."ledger_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_id" uuid NOT NULL,
	"account" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."offline_contributions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"declared_by" text NOT NULL,
	"declarer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"amount_minor" bigint,
	"currency" text,
	"eur_minor" bigint,
	"description" text,
	"proof_media_ids" uuid[] NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"decision_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."payout_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"status" text NOT NULL,
	"onboarding" text NOT NULL,
	"kyc_mode" text NOT NULL,
	"provider_verified" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."provider_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"contribution_id" uuid,
	"provider_account_id" text,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."reconciliation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"checked_transactions" integer NOT NULL,
	"discrepancies" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"provider_refund_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"commission_minor" bigint NOT NULL,
	"eur_minor" bigint NOT NULL,
	"status" text NOT NULL,
	"origin" text NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."simulated_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"country" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."simulated_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" uuid NOT NULL,
	"account_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"commission_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"status" text NOT NULL,
	"payment_id" text,
	"refunds" jsonb NOT NULL,
	"disputes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."contribution_facts" (
	"contribution_id" uuid PRIMARY KEY NOT NULL,
	"contributor_id" uuid NOT NULL,
	"organization_id" uuid,
	"project_id" uuid NOT NULL,
	"status" text NOT NULL,
	"net_eur_minor" bigint NOT NULL,
	"succeeded_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."time_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contributor_id" uuid NOT NULL,
	"project_id" uuid,
	"entrepreneur_id" uuid,
	"kind" text NOT NULL,
	"minutes" integer NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL,
	"responded_at" timestamp with time zone,
	"responded_by" uuid,
	"dispute_reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments"."discrepancies" ADD CONSTRAINT "discrepancies_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "payments"."reconciliation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."disputes" ADD CONSTRAINT "disputes_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "payments"."contributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."ledger_lines" ADD CONSTRAINT "ledger_lines_entry_id_ledger_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "payments"."ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "payments"."contributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_contributor_idx" ON "payments"."contributions" USING btree ("contributor_id","created_at","id");--> statement-breakpoint
CREATE INDEX "contributions_project_idx" ON "payments"."contributions" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "contributions_organization_idx" ON "payments"."contributions" USING btree ("organization_id","created_at") WHERE "payments"."contributions"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "contributions_pending_idx" ON "payments"."contributions" USING btree ("expires_at") WHERE "payments"."contributions"."status" = 'pending_payment';--> statement-breakpoint
CREATE INDEX "contributions_rate_idx" ON "payments"."contributions" USING btree ("contributor_id","method","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contributions_provider_session_uq" ON "payments"."contributions" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "discrepancies_status_idx" ON "payments"."discrepancies" USING btree ("status","detected_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "discrepancies_open_uq" ON "payments"."discrepancies" USING btree ("kind","reference") WHERE "payments"."discrepancies"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_provider_dispute_uq" ON "payments"."disputes" USING btree ("provider_dispute_id");--> statement-breakpoint
CREATE INDEX "kyc_submissions_user_idx" ON "payments"."kyc_submissions" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "kyc_submissions_status_idx" ON "payments"."kyc_submissions" USING btree ("status","submitted_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_submissions_pending_uq" ON "payments"."kyc_submissions" USING btree ("user_id") WHERE "payments"."kyc_submissions"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_source_uq" ON "payments"."ledger_entries" USING btree ("kind","source_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_contribution_idx" ON "payments"."ledger_entries" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_project_idx" ON "payments"."ledger_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ledger_lines_entry_idx" ON "payments"."ledger_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "ledger_lines_account_idx" ON "payments"."ledger_lines" USING btree ("account","currency");--> statement-breakpoint
CREATE INDEX "offline_contributions_project_idx" ON "payments"."offline_contributions" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "offline_contributions_contributor_idx" ON "payments"."offline_contributions" USING btree ("contributor_id","created_at","id");--> statement-breakpoint
CREATE INDEX "offline_contributions_status_idx" ON "payments"."offline_contributions" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_events_external_uq" ON "payments"."provider_events" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "provider_events_contribution_idx" ON "payments"."provider_events" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "refunds_contribution_idx" ON "payments"."refunds" USING btree ("contribution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_refund_uq" ON "payments"."refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "contribution_facts_contributor_idx" ON "engagement"."contribution_facts" USING btree ("contributor_id","succeeded_at");--> statement-breakpoint
CREATE INDEX "contribution_facts_organization_idx" ON "engagement"."contribution_facts" USING btree ("organization_id","succeeded_at") WHERE "engagement"."contribution_facts"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "time_entries_contributor_idx" ON "engagement"."time_entries" USING btree ("contributor_id","created_at","id");--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "engagement"."time_entries" USING btree ("project_id","created_at","id") WHERE "engagement"."time_entries"."project_id" is not null;--> statement-breakpoint
CREATE INDEX "time_entries_entrepreneur_idx" ON "engagement"."time_entries" USING btree ("entrepreneur_id","created_at","id") WHERE "engagement"."time_entries"."entrepreneur_id" is not null;