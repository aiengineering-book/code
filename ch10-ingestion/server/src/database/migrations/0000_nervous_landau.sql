CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"chunk_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"chunk_count" integer,
	"total_tokens" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");