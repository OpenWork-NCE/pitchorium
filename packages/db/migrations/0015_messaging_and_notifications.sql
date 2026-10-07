CREATE TABLE "messaging"."conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"direct_key" text,
	"status" text NOT NULL,
	"requested_by" uuid,
	"request_recipient_id" uuid,
	"request_decided_at" timestamp with time zone,
	"introduction_id" uuid,
	"created_by" uuid NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging"."introductions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"introducer_id" uuid NOT NULL,
	"first_id" uuid NOT NULL,
	"second_id" uuid NOT NULL,
	"note" text NOT NULL,
	"first_answer" text NOT NULL,
	"second_answer" text NOT NULL,
	"status" text NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messaging"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_message_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"attachment_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"shared_post_id" uuid,
	"moderation_status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messaging"."participants" (
	"conversation_id" uuid NOT NULL,
	"participant_type" text NOT NULL,
	"participant_id" uuid NOT NULL,
	"last_read_sequence" bigint DEFAULT 0 NOT NULL,
	"marked_unread" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"muted" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "participants_pk" PRIMARY KEY("conversation_id","participant_type","participant_id")
);
--> statement-breakpoint
CREATE TABLE "messaging"."settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"message_policy" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."deliveries" (
	"source" text NOT NULL,
	"recipient_id" uuid NOT NULL,
	"notification_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "deliveries_pk" PRIMARY KEY("source","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"group_key" text NOT NULL,
	"priority" text NOT NULL,
	"actor_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"actor_count" integer NOT NULL,
	"event_count" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"digest_pending" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."preferences" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "preferences_pk" PRIMARY KEY("user_id","type","channel")
);
--> statement-breakpoint
CREATE TABLE "notifications"."settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_digest" text NOT NULL,
	"last_digest_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"provider_event_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."unread_message_emails" (
	"recipient_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"first_sequence" integer NOT NULL,
	"last_sequence" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "unread_message_emails_pk" PRIMARY KEY("recipient_id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_direct_key_uq" ON "messaging"."conversations" USING btree ("direct_key") WHERE "messaging"."conversations"."direct_key" is not null;--> statement-breakpoint
CREATE INDEX "conversations_requests_idx" ON "messaging"."conversations" USING btree ("requested_by","created_at") WHERE "messaging"."conversations"."requested_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "introductions_pending_uq" ON "messaging"."introductions" USING btree ("introducer_id",least("first_id", "second_id"),greatest("first_id", "second_id")) WHERE "messaging"."introductions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "introductions_first_idx" ON "messaging"."introductions" USING btree ("first_id","created_at");--> statement-breakpoint
CREATE INDEX "introductions_second_idx" ON "messaging"."introductions" USING btree ("second_id","created_at");--> statement-breakpoint
CREATE INDEX "introductions_introducer_idx" ON "messaging"."introductions" USING btree ("introducer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_sequence_uq" ON "messaging"."messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_id_uq" ON "messaging"."messages" USING btree ("sender_id","client_message_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messaging"."messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "participants_member_idx" ON "messaging"."participants" USING btree ("participant_id","conversation_id");--> statement-breakpoint
CREATE INDEX "deliveries_created_idx" ON "notifications"."deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications"."notifications" USING btree ("recipient_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "notifications_open_group_idx" ON "notifications"."notifications" USING btree ("recipient_id","group_key","window_ends_at") WHERE "notifications"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications"."notifications" USING btree ("recipient_id") WHERE "notifications"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_digest_idx" ON "notifications"."notifications" USING btree ("recipient_id","created_at") WHERE "notifications"."notifications"."digest_pending";--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications"."notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "settings_digest_idx" ON "notifications"."settings" USING btree ("email_digest");--> statement-breakpoint
CREATE INDEX "unread_message_emails_due_idx" ON "notifications"."unread_message_emails" USING btree ("due_at");