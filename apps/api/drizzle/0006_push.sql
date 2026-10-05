CREATE TYPE "public"."expiry_alert" AS ENUM('off', 'same_day', '1_day', '2_days');--> statement-breakpoint
CREATE TABLE "push_sent" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_sent_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_ran_out" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "expiry_alert" "expiry_alert" DEFAULT '1_day' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "weekly_reminder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "weekly_day" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "weekly_time" text DEFAULT '10:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "push_sent" ADD CONSTRAINT "push_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_sent_sent_at_idx" ON "push_sent" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription" USING btree ("user_id");