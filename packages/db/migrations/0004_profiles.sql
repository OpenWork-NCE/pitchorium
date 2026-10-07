CREATE TABLE "profiles"."contributor_facets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"hats" text[] NOT NULL,
	"structure_type" text NOT NULL,
	"organization_name" text,
	"intervention_country_codes" text[] NOT NULL,
	"sector_codes" text[] NOT NULL,
	"ticket_min_minor" bigint,
	"ticket_max_minor" bigint,
	"ticket_currency" text,
	"accepted_instruments" text[] NOT NULL,
	"patronage_types" text[] NOT NULL,
	"mentoring_available" boolean NOT NULL,
	"open_to_expert_missions" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contributor_facets_hats_check" CHECK (cardinality("profiles"."contributor_facets"."hats") >= 1),
	CONSTRAINT "contributor_facets_ticket_check" CHECK ("profiles"."contributor_facets"."ticket_min_minor" is null or "profiles"."contributor_facets"."ticket_min_minor" <= "profiles"."contributor_facets"."ticket_max_minor")
);
--> statement-breakpoint
CREATE TABLE "profiles"."entrepreneur_facets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"sector_code" text NOT NULL,
	"stage_code" text NOT NULL,
	"company_country_code" text NOT NULL,
	"company_city" text,
	"team_size" integer,
	"founded_year" integer,
	"pitch" text,
	"needs" text[] NOT NULL,
	"sought_expertise" text[] NOT NULL,
	"funding_target_minor" bigint,
	"funding_target_currency" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles"."handle_history" (
	"handle" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"replaced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"country_code" text,
	"city" text,
	"languages" text[] NOT NULL,
	"website_url" text,
	"linkedin_url" text,
	"avatar_url" text,
	"avatar_media_id" uuid,
	"cover_media_id" uuid,
	"intention" text,
	"intention_set_at" timestamp with time zone,
	"public_page_enabled" boolean NOT NULL,
	"entrepreneur_details_visibility" text NOT NULL,
	"contributor_details_visibility" text NOT NULL,
	"network_lists_visibility" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles"."contributor_facets" ADD CONSTRAINT "contributor_facets_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."entrepreneur_facets" ADD CONSTRAINT "entrepreneur_facets_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."entrepreneur_facets" ADD CONSTRAINT "entrepreneur_facets_sector_code_sectors_code_fk" FOREIGN KEY ("sector_code") REFERENCES "profiles"."sectors"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."entrepreneur_facets" ADD CONSTRAINT "entrepreneur_facets_stage_code_stages_code_fk" FOREIGN KEY ("stage_code") REFERENCES "profiles"."stages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."entrepreneur_facets" ADD CONSTRAINT "entrepreneur_facets_company_country_code_countries_code_fk" FOREIGN KEY ("company_country_code") REFERENCES "profiles"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."handle_history" ADD CONSTRAINT "handle_history_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles"."profiles" ADD CONSTRAINT "profiles_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "profiles"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handle_history_user_id_idx" ON "profiles"."handle_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_uq" ON "profiles"."profiles" USING btree ("handle");