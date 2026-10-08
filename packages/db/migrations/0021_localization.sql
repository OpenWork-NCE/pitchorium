CREATE TABLE "localization"."glossary_terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fr" text NOT NULL,
	"en" text NOT NULL,
	"provisional" boolean NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "localization"."monthly_usage" (
	"month" text PRIMARY KEY NOT NULL,
	"characters" bigint NOT NULL,
	"warned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "localization"."translations" (
	"source_type" text NOT NULL,
	"source_key" text NOT NULL,
	"target_locale" text NOT NULL,
	"content_hash" text NOT NULL,
	"source_language" text,
	"provider" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "translations_pk" PRIMARY KEY("source_type","source_key","target_locale")
);
--> statement-breakpoint
CREATE TABLE "localization"."usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"characters" integer NOT NULL,
	CONSTRAINT "usage_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "glossary_terms_fr_uq" ON "localization"."glossary_terms" USING btree ("fr");--> statement-breakpoint
CREATE INDEX "translations_expires_at_idx" ON "localization"."translations" USING btree ("expires_at");