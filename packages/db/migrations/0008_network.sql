CREATE TABLE "network"."blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "blocks_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "network"."connection_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"note" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "network"."connections" (
	"user_id" uuid NOT NULL,
	"peer_id" uuid NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "connections_pk" PRIMARY KEY("user_id","peer_id")
);
--> statement-breakpoint
CREATE TABLE "network"."follows" (
	"follower_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "follows_pk" PRIMARY KEY("follower_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "network"."profile_views" (
	"viewed_id" uuid NOT NULL,
	"day" date NOT NULL,
	"viewer_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone NOT NULL,
	"private" boolean NOT NULL,
	CONSTRAINT "profile_views_pk" PRIMARY KEY("viewed_id","day","viewer_id")
);
--> statement-breakpoint
CREATE TABLE "network"."settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"private_profile_views" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "network"."blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "blocks_blocker_created_idx" ON "network"."blocks" USING btree ("blocker_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connection_requests_pending_pair_uq" ON "network"."connection_requests" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id")) WHERE "network"."connection_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "connection_requests_addressee_idx" ON "network"."connection_requests" USING btree ("addressee_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "connection_requests_requester_idx" ON "network"."connection_requests" USING btree ("requester_id","created_at","id");--> statement-breakpoint
CREATE INDEX "connection_requests_pending_expiry_idx" ON "network"."connection_requests" USING btree ("expires_at") WHERE "network"."connection_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "connections_user_connected_idx" ON "network"."connections" USING btree ("user_id","connected_at","peer_id");--> statement-breakpoint
CREATE INDEX "follows_target_idx" ON "network"."follows" USING btree ("target_type","target_id","created_at","follower_id");--> statement-breakpoint
CREATE INDEX "follows_follower_created_idx" ON "network"."follows" USING btree ("follower_id","created_at","target_id");--> statement-breakpoint
CREATE INDEX "profile_views_day_idx" ON "network"."profile_views" USING btree ("day");