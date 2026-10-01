CREATE TABLE "list_invite" (
	"token" text PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"role" "list_role" NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"sent_to" text,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "yjs_docs" (
	"name" text PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"has_cart" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_invite" ADD CONSTRAINT "list_invite_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_invite" ADD CONSTRAINT "list_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_invite_list_id_idx" ON "list_invite" USING btree ("list_id");