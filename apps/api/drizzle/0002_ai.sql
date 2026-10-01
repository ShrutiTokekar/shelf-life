CREATE TABLE "ai_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"pantry_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_pantry_id_day_pk" PRIMARY KEY("pantry_id","day")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_pantry_id_pantry_id_fk" FOREIGN KEY ("pantry_id") REFERENCES "public"."pantry"("id") ON DELETE cascade ON UPDATE no action;