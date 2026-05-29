CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 8) NOT NULL,
	"endpoint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
