-- Extensions are part of the initial migration so that managed databases do not depend on the local init script.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "access";
--> statement-breakpoint
CREATE SCHEMA "profiles";
--> statement-breakpoint
CREATE SCHEMA "organizations";
--> statement-breakpoint
CREATE SCHEMA "media";
--> statement-breakpoint
CREATE SCHEMA "network";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "projects";
--> statement-breakpoint
CREATE SCHEMA "impact";
--> statement-breakpoint
CREATE SCHEMA "payments";
--> statement-breakpoint
CREATE SCHEMA "engagement";
--> statement-breakpoint
CREATE SCHEMA "messaging";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "discovery";
--> statement-breakpoint
CREATE SCHEMA "events";
--> statement-breakpoint
CREATE SCHEMA "missions";
--> statement-breakpoint
CREATE SCHEMA "trust";
--> statement-breakpoint
CREATE SCHEMA "privacy";
--> statement-breakpoint
CREATE SCHEMA "localization";
--> statement-breakpoint
CREATE SCHEMA "admin";
--> statement-breakpoint
CREATE TABLE "platform"."audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"request_id" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."idempotency_keys" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "platform"."inbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform"."outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "platform"."audit_log" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "platform"."audit_log" USING btree ("actor_type","actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "platform"."audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "platform"."idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_messages_source_external_id_uq" ON "platform"."inbox_messages" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "platform"."outbox_events" USING btree ("next_attempt_at","occurred_at") WHERE "platform"."outbox_events"."published_at" is null;--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "platform"."outbox_events" USING btree ("aggregate_type","aggregate_id");