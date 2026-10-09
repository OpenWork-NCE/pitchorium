CREATE TABLE "content"."comment_mentions" (
	"comment_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "comment_mentions_pk" PRIMARY KEY("comment_id","target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "content"."comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "content"."comments"("id") ON DELETE cascade ON UPDATE no action;