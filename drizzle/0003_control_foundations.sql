CREATE TABLE "agent_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"nonce_hash" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_server_id" uuid,
	"action" text NOT NULL,
	"description" text,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"registered_host" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_nonces" ADD CONSTRAINT "agent_nonces_server_id_control_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."control_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_server_id_control_servers_id_fk" FOREIGN KEY ("actor_server_id") REFERENCES "public"."control_servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_servers" ADD CONSTRAINT "control_servers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_nonces_nonce_hash_unique_idx" ON "agent_nonces" USING btree ("nonce_hash");--> statement-breakpoint
CREATE INDEX "agent_nonces_server_id_expires_at_idx" ON "agent_nonces" USING btree ("server_id","expires_at");--> statement-breakpoint
CREATE INDEX "agent_nonces_expires_at_idx" ON "agent_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_server_id_idx" ON "audit_log" USING btree ("actor_server_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "control_servers_token_hash_unique_idx" ON "control_servers" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "control_servers_org_id_idx" ON "control_servers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "control_servers_status_idx" ON "control_servers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_key_hash_unique_idx" ON "licenses" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "licenses_customer_id_idx" ON "licenses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "licenses_organization_id_idx" ON "licenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "licenses_status_idx" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");