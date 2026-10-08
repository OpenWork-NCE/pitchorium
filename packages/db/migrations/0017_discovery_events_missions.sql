CREATE TABLE "discovery"."dismissals" (
	"user_id" uuid NOT NULL,
	"candidate_kind" text NOT NULL,
	"candidate_id" uuid NOT NULL,
	"dismissed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dismissals_pk" PRIMARY KEY("user_id","candidate_kind","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "discovery"."match_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"residence_country" text,
	"languages" text[] NOT NULL,
	"has_entrepreneur" boolean NOT NULL,
	"entrepreneur_visibility" text NOT NULL,
	"company_country" text,
	"entrepreneur_sector" text,
	"needs" text[] NOT NULL,
	"funding_target_minor" bigint,
	"funding_target_currency" text,
	"has_contributor" boolean NOT NULL,
	"contributor_visibility" text NOT NULL,
	"hats" text[] NOT NULL,
	"intervention_countries" text[] NOT NULL,
	"contributor_sectors" text[] NOT NULL,
	"ticket_min_minor" bigint,
	"ticket_max_minor" bigint,
	"ticket_currency" text,
	"instruments" text[] NOT NULL,
	"mentoring_available" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery"."search_documents" (
	"kind" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"audience" text NOT NULL,
	"key" text NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"subtitle" text,
	"document" "tsvector" NOT NULL,
	"country_codes" text[] NOT NULL,
	"sector_codes" text[] NOT NULL,
	"tags" text[] NOT NULL,
	"status" text,
	"impact_score" integer,
	"amount_minor" bigint,
	"currency" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"featured_at" timestamp with time zone,
	"fingerprint" text NOT NULL,
	"indexed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "search_documents_pk" PRIMARY KEY("kind","entity_id","audience")
);
--> statement-breakpoint
CREATE TABLE "discovery"."suggestions" (
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"list" text NOT NULL,
	"candidate_kind" text NOT NULL,
	"candidate_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"rules_version" integer NOT NULL,
	"first_suggested_at" timestamp with time zone NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "suggestions_pk" PRIMARY KEY("subject_type","subject_id","list","candidate_kind","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "events"."calendar_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"organizer_id" uuid NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"visibility" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"location_name" text,
	"location_address" text,
	"location_city" text,
	"location_country_code" text,
	"online_url" text,
	"language" text NOT NULL,
	"sector_codes" text[] NOT NULL,
	"country_codes" text[] NOT NULL,
	"image_media_id" uuid,
	"capacity" integer,
	"registered_count" integer NOT NULL,
	"waitlist_count" integer NOT NULL,
	"sequence" integer NOT NULL,
	"moderation_status" text NOT NULL,
	"cancel_reason" text,
	"published_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events"."registrations" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"show_in_attendees" boolean NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"promoted_at" timestamp with time zone,
	CONSTRAINT "registrations_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events"."slug_history" (
	"slug" text PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"replaced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions"."engagements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mission_id" uuid NOT NULL,
	"expert_id" uuid NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"project_id" uuid,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"answer_message" text,
	"time_entry_id" uuid,
	"requested_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions"."missions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"author_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"domain" text NOT NULL,
	"sector_codes" text[] NOT NULL,
	"format" text NOT NULL,
	"estimated_hours" integer NOT NULL,
	"mode" text NOT NULL,
	"country_codes" text[] NOT NULL,
	"languages" text[] NOT NULL,
	"capacity" integer NOT NULL,
	"skills" text[] NOT NULL,
	"desired_by" date,
	"visibility" text NOT NULL,
	"status" text NOT NULL,
	"moderation_status" text NOT NULL,
	"active_engagements" integer NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."slug_history" ADD CONSTRAINT "slug_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions"."engagements" ADD CONSTRAINT "engagements_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "missions"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_profiles_hats_idx" ON "discovery"."match_profiles" USING gin ("hats");--> statement-breakpoint
CREATE INDEX "match_profiles_needs_idx" ON "discovery"."match_profiles" USING gin ("needs");--> statement-breakpoint
CREATE INDEX "match_profiles_contributor_sectors_idx" ON "discovery"."match_profiles" USING gin ("contributor_sectors");--> statement-breakpoint
CREATE INDEX "match_profiles_intervention_idx" ON "discovery"."match_profiles" USING gin ("intervention_countries");--> statement-breakpoint
CREATE INDEX "match_profiles_company_country_idx" ON "discovery"."match_profiles" USING btree ("company_country") WHERE "discovery"."match_profiles"."has_entrepreneur";--> statement-breakpoint
CREATE INDEX "match_profiles_entrepreneur_sector_idx" ON "discovery"."match_profiles" USING btree ("entrepreneur_sector") WHERE "discovery"."match_profiles"."has_entrepreneur";--> statement-breakpoint
CREATE INDEX "search_documents_document_idx" ON "discovery"."search_documents" USING gin ("document");--> statement-breakpoint
CREATE INDEX "search_documents_name_trgm_idx" ON "discovery"."search_documents" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_documents_tags_idx" ON "discovery"."search_documents" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "search_documents_countries_idx" ON "discovery"."search_documents" USING gin ("country_codes");--> statement-breakpoint
CREATE INDEX "search_documents_sectors_idx" ON "discovery"."search_documents" USING gin ("sector_codes");--> statement-breakpoint
CREATE INDEX "search_documents_recent_idx" ON "discovery"."search_documents" USING btree ("audience","kind","published_at","entity_id");--> statement-breakpoint
CREATE INDEX "search_documents_ends_at_idx" ON "discovery"."search_documents" USING btree ("audience","kind","ends_at","entity_id") WHERE "discovery"."search_documents"."ends_at" is not null;--> statement-breakpoint
CREATE INDEX "search_documents_starts_at_idx" ON "discovery"."search_documents" USING btree ("audience","kind","starts_at","entity_id") WHERE "discovery"."search_documents"."starts_at" is not null;--> statement-breakpoint
CREATE INDEX "search_documents_key_idx" ON "discovery"."search_documents" USING btree ("kind","key");--> statement-breakpoint
CREATE INDEX "suggestions_ranking_idx" ON "discovery"."suggestions" USING btree ("subject_type","subject_id","list","score","candidate_id");--> statement-breakpoint
CREATE INDEX "suggestions_candidate_idx" ON "discovery"."suggestions" USING btree ("candidate_kind","candidate_id");--> statement-breakpoint
CREATE INDEX "suggestions_first_suggested_idx" ON "discovery"."suggestions" USING btree ("first_suggested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_tokens_token_hash_uq" ON "events"."calendar_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uq" ON "events"."events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events"."events" USING btree ("organizer_id","created_at");--> statement-breakpoint
CREATE INDEX "events_organization_id_idx" ON "events"."events" USING btree ("organization_id") WHERE "events"."events"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "events_listing_idx" ON "events"."events" USING btree ("ends_at","id") WHERE "events"."events"."status" = 'published' and "events"."events"."deleted_at" is null and "events"."events"."moderation_status" = 'visible';--> statement-breakpoint
CREATE INDEX "events_feed_idx" ON "events"."events" USING btree ("organizer_id","published_at","id") WHERE "events"."events"."status" = 'published' and "events"."events"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "registrations_queue_idx" ON "events"."registrations" USING btree ("event_id","status","registered_at","user_id");--> statement-breakpoint
CREATE INDEX "registrations_user_id_idx" ON "events"."registrations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "events_slug_history_event_id_idx" ON "events"."slug_history" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engagements_open_uq" ON "missions"."engagements" USING btree ("mission_id","expert_id","beneficiary_id") WHERE "missions"."engagements"."status" in ('requested', 'accepted');--> statement-breakpoint
CREATE INDEX "engagements_mission_id_idx" ON "missions"."engagements" USING btree ("mission_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "engagements_expert_id_idx" ON "missions"."engagements" USING btree ("expert_id","requested_at");--> statement-breakpoint
CREATE INDEX "engagements_beneficiary_id_idx" ON "missions"."engagements" USING btree ("beneficiary_id","requested_at");--> statement-breakpoint
CREATE INDEX "missions_open_idx" ON "missions"."missions" USING btree ("published_at","id") WHERE "missions"."missions"."status" = 'open' and "missions"."missions"."moderation_status" = 'visible';--> statement-breakpoint
CREATE INDEX "missions_author_id_idx" ON "missions"."missions" USING btree ("author_id","published_at");--> statement-breakpoint
CREATE INDEX "missions_project_id_idx" ON "missions"."missions" USING btree ("project_id") WHERE "missions"."missions"."project_id" is not null;