CREATE TABLE "privacy"."erasures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"status" text NOT NULL,
	"pseudonym" uuid,
	"contact" jsonb,
	"progress" text[] NOT NULL,
	"blocked_by" text,
	"residues" text[],
	"requested_at" timestamp with time zone NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"reminded_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "privacy"."exports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"status" text NOT NULL,
	"storage_key" text,
	"size_bytes" bigint,
	"error" text,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "identity"."legal_acceptances" DROP CONSTRAINT "legal_acceptances_user_id_users_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "erasures_open_user_uq" ON "privacy"."erasures" USING btree ("user_id") WHERE "privacy"."erasures"."status" in ('scheduled', 'running', 'blocked');--> statement-breakpoint
CREATE INDEX "erasures_due_idx" ON "privacy"."erasures" USING btree ("scheduled_for") WHERE "privacy"."erasures"."status" in ('scheduled', 'running');--> statement-breakpoint
CREATE INDEX "erasures_requested_at_idx" ON "privacy"."erasures" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "exports_user_id_idx" ON "privacy"."exports" USING btree ("user_id","requested_at");--> statement-breakpoint
CREATE INDEX "exports_expires_at_idx" ON "privacy"."exports" USING btree ("expires_at") WHERE "privacy"."exports"."status" = 'ready';