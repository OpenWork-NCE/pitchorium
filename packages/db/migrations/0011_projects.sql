CREATE TABLE "projects"."funding_entries" (
	"contribution_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	"reversed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects"."interests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"indicative_amount_minor" bigint,
	"indicative_currency" text,
	"document_media_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"description" text,
	"sector_code" text,
	"impact_area" text,
	"country_codes" text[] NOT NULL,
	"video_provider" text,
	"video_id" text,
	"video_hash" text,
	"instruments" text[] NOT NULL,
	"opens_capital" boolean NOT NULL,
	"currency" text NOT NULL,
	"goal_minor" bigint,
	"duration_days" integer,
	"gallery_media_ids" uuid[] NOT NULL,
	"document_media_ids" uuid[] NOT NULL,
	"status" text NOT NULL,
	"collected_minor" bigint NOT NULL,
	"contribution_count" integer NOT NULL,
	"first_contribution_at" timestamp with time zone,
	"public_display_consent_at" timestamp with time zone,
	"public_display_consent_by" uuid,
	"impact_score" integer,
	"impact_level" text,
	"impact_methodology_version" integer,
	"moderation_status" text NOT NULL,
	"featured_at" timestamp with time zone,
	"featured_by" uuid,
	"published_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"funded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"ending_soon_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects"."reward_reservations" (
	"contribution_id" uuid PRIMARY KEY NOT NULL,
	"reward_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"min_amount_minor" bigint NOT NULL,
	"instruments" text[] NOT NULL,
	"quantity" integer,
	"reserved" integer NOT NULL,
	"confirmed" integer NOT NULL,
	"estimated_delivery" date,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."slug_history" (
	"slug" text PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"replaced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."team_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"function" text,
	"status" text NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone NOT NULL,
	"joined_at" timestamp with time zone,
	"public_display_consent_at" timestamp with time zone,
	CONSTRAINT "team_members_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects"."tiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"threshold_minor" bigint NOT NULL,
	"description" text NOT NULL,
	"unlocked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects"."updates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"image_media_ids" uuid[] NOT NULL,
	"moderation_status" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects"."funding_entries" ADD CONSTRAINT "funding_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."interests" ADD CONSTRAINT "interests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."reward_reservations" ADD CONSTRAINT "reward_reservations_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "projects"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."rewards" ADD CONSTRAINT "rewards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."slug_history" ADD CONSTRAINT "slug_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."team_members" ADD CONSTRAINT "team_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."tiers" ADD CONSTRAINT "tiers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."updates" ADD CONSTRAINT "updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funding_entries_project_id_idx" ON "projects"."funding_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "interests_project_idx" ON "projects"."interests" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_uq" ON "projects"."projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects"."projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects"."projects" USING btree ("organization_id") WHERE "projects"."projects"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "projects_showcase_idx" ON "projects"."projects" USING btree ("published_at","id") WHERE "projects"."projects"."status" <> 'draft' and "projects"."projects"."deleted_at" is null and "projects"."projects"."moderation_status" = 'visible';--> statement-breakpoint
CREATE INDEX "projects_open_ends_at_idx" ON "projects"."projects" USING btree ("ends_at","id") WHERE "projects"."projects"."status" in ('funding', 'funded') and "projects"."projects"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "reward_reservations_reward_id_idx" ON "projects"."reward_reservations" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "rewards_project_id_idx" ON "projects"."rewards" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "slug_history_project_id_idx" ON "projects"."slug_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "projects"."team_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_project_position_uq" ON "projects"."tiers" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "updates_project_feed_idx" ON "projects"."updates" USING btree ("project_id","published_at","id") WHERE "projects"."updates"."deleted_at" is null and "projects"."updates"."moderation_status" = 'visible';