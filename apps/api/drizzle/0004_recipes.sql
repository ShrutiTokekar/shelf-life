CREATE TYPE "public"."diet" AS ENUM('any', 'eggs', 'vegetarian', 'vegan');--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"pantry_id" uuid,
	"recipe_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_recipe" (
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_recipe_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "diet" "diet" DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "cuisines" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "max_minutes" integer;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "avoid" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD CONSTRAINT "recipe_cache_pantry_id_pantry_id_fk" FOREIGN KEY ("pantry_id") REFERENCES "public"."pantry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_recipe" ADD CONSTRAINT "saved_recipe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;