CREATE TABLE "access"."role_assignments" (
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "role_assignments_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE INDEX "role_assignments_role_idx" ON "access"."role_assignments" USING btree ("role");