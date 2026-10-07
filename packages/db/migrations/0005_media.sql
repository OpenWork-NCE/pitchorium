CREATE TABLE "media"."assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"usage" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"visibility" text NOT NULL,
	"declared_content_type" text NOT NULL,
	"declared_size" bigint NOT NULL,
	"content_type" text,
	"size" bigint,
	"sha256" text,
	"width" integer,
	"height" integer,
	"page_count" integer,
	"quarantine_key" text NOT NULL,
	"files" jsonb,
	"rejection_reason" text,
	"moderation_status" text NOT NULL,
	"import_url" text,
	"attached_resource_type" text,
	"attached_resource_id" text,
	"attached_at" timestamp with time zone,
	"unattached_since" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"purged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "assets_owner_id_idx" ON "media"."assets" USING btree ("owner_id") WHERE "media"."assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_attached_resource_idx" ON "media"."assets" USING btree ("attached_resource_type","attached_resource_id") WHERE "media"."assets"."attached_resource_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_unattached_since_idx" ON "media"."assets" USING btree ("unattached_since") WHERE "media"."assets"."attached_resource_id" is null and "media"."assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_purge_pending_idx" ON "media"."assets" USING btree ("deleted_at") WHERE "media"."assets"."deleted_at" is not null and "media"."assets"."purged_at" is null;