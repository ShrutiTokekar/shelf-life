ALTER TABLE "session" ADD COLUMN "client" text DEFAULT 'browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;