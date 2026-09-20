CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"description" text,
	"provider_invoice_id" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'published' NOT NULL,
	"body" text NOT NULL,
	"body_json" jsonb,
	"related_tools" jsonb,
	"related_articles" jsonb,
	"featured" boolean DEFAULT false NOT NULL,
	"reading_time_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kb_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"plan" text DEFAULT 'managed_support' NOT NULL,
	"price_per_cycle" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"provider_subscription_id" text,
	"canceled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"affected_domain" text,
	"related_tool" text,
	"notify_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "support_tickets_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_category_id_kb_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_user_id_invoice_number_unique_idx" ON "invoices" USING btree ("user_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_user_id_status_idx" ON "invoices" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "invoices_user_id_created_at_idx" ON "invoices" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "kb_articles_category_id_idx" ON "kb_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "kb_articles_category_slug_idx" ON "kb_articles" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "kb_articles_status_idx" ON "kb_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kb_articles_published_at_idx" ON "kb_articles" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_categories_slug_unique_idx" ON "kb_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_unique_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_id_status_idx" ON "support_tickets" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "support_tickets_reference_idx" ON "support_tickets" USING btree ("reference");