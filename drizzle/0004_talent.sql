CREATE TABLE "talent_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"recruiter_notes" text,
	"screening_notes" text,
	"client_submission_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"whatsapp" text,
	"current_location" text,
	"preferred_location" text,
	"total_experience" integer,
	"relevant_experience" integer,
	"current_company" text,
	"current_ctc" integer,
	"expected_ctc" integer,
	"notice_period" text,
	"highest_qualification" text,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linkedin_url" text,
	"preferred_work_mode" text,
	"shift_preference" text,
	"relocation_preference" text,
	"source" text DEFAULT 'website' NOT NULL,
	"consent_status" text DEFAULT 'pending' NOT NULL,
	"consent_at" timestamp with time zone,
	"internal_notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"company_website" text,
	"industry" text,
	"company_location" text,
	"company_size" text,
	"contact_name" text,
	"contact_designation" text,
	"contact_email" text,
	"contact_phone" text,
	"linkedin_url" text,
	"status" text DEFAULT 'PROSPECT' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid,
	"kind" text DEFAULT 'resume' NOT NULL,
	"original_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text,
	"uploaded_by_user_id" uuid,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"round" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"interview_type" text DEFAULT 'video' NOT NULL,
	"meeting_link" text,
	"interviewer" text,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"employment_type" text DEFAULT 'full_time' NOT NULL,
	"location" text,
	"work_mode" text DEFAULT 'onsite' NOT NULL,
	"experience_min" integer,
	"experience_max" integer,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text DEFAULT 'INR' NOT NULL,
	"salary_public" boolean DEFAULT false NOT NULL,
	"openings" integer DEFAULT 1 NOT NULL,
	"required_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualification" text,
	"shift" text,
	"notice_period_requirement" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "talent_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"client_id" uuid,
	"job_id" uuid,
	"placement_date" timestamp with time zone,
	"joining_date" timestamp with time zone,
	"annual_ctc" integer,
	"fee_type" text DEFAULT 'percentage' NOT NULL,
	"fee_percentage" integer,
	"fixed_fee" integer,
	"fee_amount" integer,
	"payment_status" text DEFAULT 'PENDING' NOT NULL,
	"payment_due_date" timestamp with time zone,
	"replacement_period_days" integer,
	"replacement_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "talent_activity_log" ADD CONSTRAINT "talent_activity_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_applications" ADD CONSTRAINT "talent_applications_candidate_id_talent_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."talent_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_applications" ADD CONSTRAINT "talent_applications_job_id_talent_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."talent_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_documents" ADD CONSTRAINT "talent_documents_candidate_id_talent_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."talent_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_documents" ADD CONSTRAINT "talent_documents_application_id_talent_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."talent_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_documents" ADD CONSTRAINT "talent_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_interviews" ADD CONSTRAINT "talent_interviews_application_id_talent_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."talent_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_jobs" ADD CONSTRAINT "talent_jobs_client_id_talent_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."talent_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_placements" ADD CONSTRAINT "talent_placements_application_id_talent_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."talent_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_placements" ADD CONSTRAINT "talent_placements_candidate_id_talent_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."talent_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_placements" ADD CONSTRAINT "talent_placements_client_id_talent_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."talent_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_placements" ADD CONSTRAINT "talent_placements_job_id_talent_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."talent_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "talent_activity_log_entity_idx" ON "talent_activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "talent_activity_log_created_at_idx" ON "talent_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "talent_activity_log_action_idx" ON "talent_activity_log" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_applications_application_id_unique_idx" ON "talent_applications" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_applications_candidate_job_unique_idx" ON "talent_applications" USING btree ("candidate_id","job_id");--> statement-breakpoint
CREATE INDEX "talent_applications_job_id_idx" ON "talent_applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "talent_applications_status_idx" ON "talent_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "talent_applications_candidate_id_idx" ON "talent_applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_candidates_candidate_id_unique_idx" ON "talent_candidates" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "talent_candidates_email_idx" ON "talent_candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX "talent_candidates_created_at_idx" ON "talent_candidates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "talent_candidates_full_name_idx" ON "talent_candidates" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "talent_clients_status_idx" ON "talent_clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "talent_clients_company_name_idx" ON "talent_clients" USING btree ("company_name");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_documents_storage_key_unique_idx" ON "talent_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "talent_documents_candidate_id_idx" ON "talent_documents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "talent_documents_application_id_idx" ON "talent_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "talent_interviews_application_id_idx" ON "talent_interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "talent_interviews_scheduled_at_idx" ON "talent_interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "talent_interviews_status_idx" ON "talent_interviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_jobs_job_id_unique_idx" ON "talent_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "talent_jobs_status_idx" ON "talent_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "talent_jobs_client_id_idx" ON "talent_jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "talent_jobs_status_created_at_idx" ON "talent_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "talent_placements_application_id_unique_idx" ON "talent_placements" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "talent_placements_client_id_idx" ON "talent_placements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "talent_placements_payment_status_idx" ON "talent_placements" USING btree ("payment_status");