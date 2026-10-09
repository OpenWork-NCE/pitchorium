CREATE TABLE "content"."link_previews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"description" text,
	"site_name" text,
	"image_media_id" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "link_previews_owner_idx" ON "content"."link_previews" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "link_previews_created_idx" ON "content"."link_previews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "link_previews_image_idx" ON "content"."link_previews" USING btree ("image_media_id") WHERE "content"."link_previews"."image_media_id" is not null;