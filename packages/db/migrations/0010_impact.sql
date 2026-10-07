CREATE TABLE "impact"."assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"methodology_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact"."methodologies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"demo" boolean NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "impact"."assessments" ADD CONSTRAINT "assessments_methodology_id_methodologies_id_fk" FOREIGN KEY ("methodology_id") REFERENCES "impact"."methodologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_subject_idx" ON "impact"."assessments" USING btree ("subject_type","subject_id","submitted_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "methodologies_version_uq" ON "impact"."methodologies" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "methodologies_published_uq" ON "impact"."methodologies" USING btree ("status") WHERE "impact"."methodologies"."status" = 'published';