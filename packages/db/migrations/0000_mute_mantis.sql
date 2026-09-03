CREATE TYPE "public"."action_type" AS ENUM('decision', 'add');--> statement-breakpoint
CREATE TYPE "public"."age" AS ENUM('fire', 'steam', 'orbital', 'oblivion');--> statement-breakpoint
CREATE TYPE "public"."char_kind" AS ENUM('figure', 'extra');--> statement-breakpoint
CREATE TYPE "public"."day_source" AS ENUM('model', 'template');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('f', 'm');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TYPE "public"."world_status" AS ENUM('active', 'paused', 'over_budget');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"kind" char_kind NOT NULL,
	"name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"age_years" integer NOT NULL,
	"role" text NOT NULL,
	"traits" text[] DEFAULT '{}' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"memory" jsonb DEFAULT '{"summary":"","facts":[]}'::jsonb NOT NULL,
	"quote" text,
	"alive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "day_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"raw_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condensed" text DEFAULT '' NOT NULL,
	"chronicle" jsonb,
	"decision" jsonb,
	"decision_answer" text,
	"source" "day_source" DEFAULT 'template' NOT NULL,
	"model_id" text DEFAULT 'template' NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_cents" numeric(8, 4) DEFAULT '0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"type" "action_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"seed" integer NOT NULL,
	"age" "age" DEFAULT 'fire' NOT NULL,
	"day" integer DEFAULT 1 NOT NULL,
	"state" jsonb NOT NULL,
	"last_simulated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"budget_cents_month" integer DEFAULT 15 NOT NULL,
	"spent_cents_month" numeric(10, 4) DEFAULT '0' NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"status" "world_status" DEFAULT 'active' NOT NULL,
	"catchup_status" text DEFAULT 'idle' NOT NULL,
	"catchup_current" integer DEFAULT 0 NOT NULL,
	"catchup_total" integer DEFAULT 0 NOT NULL,
	"catchup_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "characters" ADD CONSTRAINT "characters_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_actions" ADD CONSTRAINT "player_actions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "day_logs_world_day" ON "day_logs" USING btree ("world_id","day");