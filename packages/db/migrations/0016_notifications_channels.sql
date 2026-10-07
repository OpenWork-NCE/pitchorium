DROP INDEX "notifications"."notifications_recipient_idx";--> statement-breakpoint
DROP INDEX "notifications"."notifications_unread_idx";--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD COLUMN "in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD COLUMN "email_mode" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_low_priority_idx" ON "notifications"."notifications" USING btree ("recipient_id","created_at") WHERE "notifications"."notifications"."priority" = 'low';--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications"."notifications" USING btree ("recipient_id","updated_at","id") WHERE "notifications"."notifications"."in_app";--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications"."notifications" USING btree ("recipient_id") WHERE "notifications"."notifications"."read_at" is null and "notifications"."notifications"."in_app";