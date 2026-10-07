CREATE TABLE "content"."comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"moderation_status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content"."hidden_posts" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"hidden_at" timestamp with time zone NOT NULL,
	CONSTRAINT "hidden_posts_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "content"."post_daily_views" (
	"post_id" uuid NOT NULL,
	"day" date NOT NULL,
	"unique_viewers" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "post_daily_views_pk" PRIMARY KEY("post_id","day")
);
--> statement-breakpoint
CREATE TABLE "content"."post_mentions" (
	"post_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "post_mentions_pk" PRIMARY KEY("post_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "content"."posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" text NOT NULL,
	"text" text,
	"language" text,
	"language_source" text NOT NULL,
	"visibility" text NOT NULL,
	"repost_of_id" uuid,
	"project_id" uuid,
	"image_media_ids" uuid[] NOT NULL,
	"document_media_id" uuid,
	"link_url" text,
	"link_preview" jsonb,
	"comments_disabled" boolean NOT NULL,
	"moderation_status" text NOT NULL,
	"featured_at" timestamp with time zone,
	"featured_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content"."reactions" (
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reactions_pk" PRIMARY KEY("target_type","target_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "content"."saved_posts" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "saved_posts_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "content"."comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "content"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hidden_posts" ADD CONSTRAINT "hidden_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."post_daily_views" ADD CONSTRAINT "post_daily_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."post_mentions" ADD CONSTRAINT "post_mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD CONSTRAINT "posts_repost_of_id_posts_id_fk" FOREIGN KEY ("repost_of_id") REFERENCES "content"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_top_level_idx" ON "content"."comments" USING btree ("post_id","created_at","id") WHERE "content"."comments"."parent_id" is null and "content"."comments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "comments_replies_idx" ON "content"."comments" USING btree ("parent_id","created_at","id") WHERE "content"."comments"."parent_id" is not null and "content"."comments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_member_feed_idx" ON "content"."posts" USING btree ("author_id","created_at","id") WHERE "content"."posts"."deleted_at" is null and "content"."posts"."organization_id" is null;--> statement-breakpoint
CREATE INDEX "posts_organization_feed_idx" ON "content"."posts" USING btree ("organization_id","created_at","id") WHERE "content"."posts"."deleted_at" is null and "content"."posts"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "posts_featured_idx" ON "content"."posts" USING btree ("featured_at","id") WHERE "content"."posts"."featured_at" is not null and "content"."posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_repost_of_idx" ON "content"."posts" USING btree ("repost_of_id") WHERE "content"."posts"."repost_of_id" is not null and "content"."posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_link_preview_image_idx" ON "content"."posts" USING btree (("link_preview" ->> 'imageMediaId')) WHERE "content"."posts"."link_preview" ->> 'imageMediaId' is not null;--> statement-breakpoint
CREATE INDEX "saved_posts_user_saved_idx" ON "content"."saved_posts" USING btree ("user_id","saved_at","post_id");