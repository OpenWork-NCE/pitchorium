CREATE TABLE "organizations"."invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"token_hash" text,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"responded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "organizations"."members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "members_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations"."organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"structure_type" text NOT NULL,
	"description" text,
	"country_codes" text[] NOT NULL,
	"sector_codes" text[] NOT NULL,
	"website_url" text,
	"founded_year" integer,
	"logo_media_id" uuid,
	"cover_media_id" uuid,
	"verification_status" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations"."slug_history" (
	"slug" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"replaced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations"."verification_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"declaration" text NOT NULL,
	"document_media_ids" uuid[] NOT NULL,
	"signals" jsonb NOT NULL,
	"status" text NOT NULL,
	"criteria_met" text[] NOT NULL,
	"decision_reason" text,
	"decided_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles"."contributor_facets" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations"."members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations"."slug_history" ADD CONSTRAINT "slug_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations"."verification_requests" ADD CONSTRAINT "verification_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_uq" ON "organizations"."invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_uq" ON "organizations"."invitations" USING btree ("organization_id","email") WHERE "organizations"."invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "organizations"."members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_created_by_idx" ON "organizations"."organizations" USING btree ("created_by") WHERE "organizations"."organizations"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "slug_history_organization_id_idx" ON "organizations"."slug_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_idx" ON "organizations"."verification_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_requests_pending_uq" ON "organizations"."verification_requests" USING btree ("organization_id") WHERE "organizations"."verification_requests"."status" = 'pending';