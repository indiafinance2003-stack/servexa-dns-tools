DROP INDEX "kb_articles_category_slug_idx";--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "author_user_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "origin" text DEFAULT 'managed_support' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "responsibility" text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "service_slug" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "entitlement_source" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "context_json" jsonb;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "assigned_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "last_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_is_internal_idx" ON "support_messages" USING btree ("is_internal");--> statement-breakpoint
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "support_tickets_origin_idx" ON "support_tickets" USING btree ("origin");--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_slug_unique" UNIQUE("slug");