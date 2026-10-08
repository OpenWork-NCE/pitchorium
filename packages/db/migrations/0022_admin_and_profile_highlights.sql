CREATE TABLE "admin"."flag_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"legal_reference" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles"."profiles" ADD COLUMN "featured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles"."profiles" ADD COLUMN "featured_by" uuid;--> statement-breakpoint
CREATE INDEX "flag_changes_key_idx" ON "admin"."flag_changes" USING btree ("key","changed_at");