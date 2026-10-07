CREATE TABLE "profiles"."countries" (
	"code" text PRIMARY KEY NOT NULL,
	"m49_region" text,
	"m49_sub_region" text,
	"m49_intermediate_region" text
);
--> statement-breakpoint
CREATE TABLE "profiles"."sectors" (
	"code" text PRIMARY KEY NOT NULL,
	"isic_section" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles"."stages" (
	"code" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL
);
