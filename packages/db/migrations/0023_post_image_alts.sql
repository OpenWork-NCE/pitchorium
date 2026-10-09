ALTER TABLE "content"."posts" ADD COLUMN "image_alts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD COLUMN "document_title" text;