CREATE TABLE "projects"."funding_reversals" (
	"reversal_id" uuid PRIMARY KEY NOT NULL,
	"contribution_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"reversed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects"."funding_entries" ADD COLUMN "reversed_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects"."funding_reversals" ADD CONSTRAINT "funding_reversals_contribution_id_funding_entries_contribution_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "projects"."funding_entries"("contribution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funding_reversals_contribution_id_idx" ON "projects"."funding_reversals" USING btree ("contribution_id");--> statement-breakpoint
UPDATE "projects"."funding_entries" SET "reversed_minor" = "amount_minor" WHERE "reversed_at" IS NOT NULL;
