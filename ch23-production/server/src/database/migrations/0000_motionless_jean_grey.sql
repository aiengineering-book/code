CREATE TABLE "experiment_results" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"trace_id" text,
	"score" real,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"user_rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model" text NOT NULL,
	"endpoint" text DEFAULT 'api' NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost" real NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
