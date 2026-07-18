-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'operator');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('discovered', 'enriching', 'drafted', 'queued', 'sent', 'skipped', 'rejected', 'bounced', 'replied');

-- CreateEnum
CREATE TYPE "LeadOutcome" AS ENUM ('none', 'interested', 'not_interested', 'meeting_booked', 'customer', 'unsubscribed');

-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('email', 'instagram_dm');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('unverified', 'valid', 'invalid', 'not_found');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('email', 'website_form');

-- CreateEnum
CREATE TYPE "BusinessSource" AS ENUM ('google_places', 'instagram');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('email_outbound', 'email_reply', 'instagram_dm');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('sent', 'bounced', 'failed');

-- CreateEnum
CREATE TYPE "ReplyClassification" AS ENUM ('interested', 'question', 'not_interested', 'opt_out', 'auto_reply', 'complaint', 'other');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('unsubscribed', 'bounced_hard', 'manual_reject', 'complaint');

-- CreateEnum
CREATE TYPE "BatchChannel" AS ENUM ('email', 'instagram');

-- CreateTable
CREATE TABLE "business_lines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "company_legal_name" TEXT NOT NULL,
    "postal_address" TEXT,
    "sending_domain" TEXT NOT NULL,
    "sending_inboxes" JSONB NOT NULL,
    "privacy_policy_url" TEXT,
    "channels_enabled" JSONB NOT NULL,
    "send_limits" JSONB NOT NULL,
    "warmup_complete" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "key_features" TEXT[],
    "target_business_types" TEXT[],
    "link" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "moq" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "subject_skeleton" TEXT,
    "body_skeleton" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targeting_profiles" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "google_place_types" TEXT[],
    "keywords" TEXT[],
    "exclusions" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "targeting_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "google_place_id" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "source" "BusinessSource" NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instagram_handle" TEXT,
    "instagram_followers" INTEGER,
    "instagram_bio" TEXT,
    "instagram_website" TEXT,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "email" TEXT,
    "email_status" "EmailStatus" NOT NULL DEFAULT 'unverified',
    "contact_first_name" TEXT,
    "contact_method" "ContactMethod",
    "channel" "LeadChannel" NOT NULL DEFAULT 'email',
    "status" "LeadStatus" NOT NULL DEFAULT 'discovered',
    "outcome" "LeadOutcome" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "grounding_facts" JSONB NOT NULL,
    "open_placeholders" TEXT[],
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_drafts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "grounding_facts" JSONB NOT NULL,
    "open_placeholders" TEXT[],
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dm_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sends" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sending_inbox" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" "SendStatus" NOT NULL,
    "approved_by_user_id" TEXT NOT NULL,
    "approved_via" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_sends" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "dm_draft_id" TEXT NOT NULL,
    "marked_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sending_account" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,

    CONSTRAINT "dm_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "send_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_email" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider_thread_id" TEXT,
    "classification" "ReplyClassification" NOT NULL,
    "classification_confidence" DOUBLE PRECISION NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handled_by" TEXT,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_drafts" (
    "id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "grounding_facts" JSONB NOT NULL,
    "open_placeholders" TEXT[],
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppression_list" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "email" TEXT,
    "domain" TEXT,
    "google_place_id" TEXT,
    "instagram_handle" TEXT,
    "reason" "SuppressionReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppression_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "channel" "BatchChannel" NOT NULL,
    "size_requested" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "run_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "telegram_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_business_line_id_idx" ON "products"("business_line_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "templates_business_line_id_idx" ON "templates"("business_line_id");

-- CreateIndex
CREATE INDEX "targeting_profiles_business_line_id_idx" ON "targeting_profiles"("business_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_google_place_id_key" ON "businesses"("google_place_id");

-- CreateIndex
CREATE INDEX "businesses_business_line_id_idx" ON "businesses"("business_line_id");

-- CreateIndex
CREATE INDEX "leads_business_line_id_idx" ON "leads"("business_line_id");

-- CreateIndex
CREATE INDEX "leads_business_id_idx" ON "leads"("business_id");

-- CreateIndex
CREATE INDEX "drafts_lead_id_idx" ON "drafts"("lead_id");

-- CreateIndex
CREATE INDEX "dm_drafts_lead_id_idx" ON "dm_drafts"("lead_id");

-- CreateIndex
CREATE INDEX "sends_lead_id_idx" ON "sends"("lead_id");

-- CreateIndex
CREATE INDEX "dm_sends_lead_id_idx" ON "dm_sends"("lead_id");

-- CreateIndex
CREATE INDEX "replies_lead_id_idx" ON "replies"("lead_id");

-- CreateIndex
CREATE INDEX "reply_drafts_reply_id_idx" ON "reply_drafts"("reply_id");

-- CreateIndex
CREATE INDEX "suppression_list_business_line_id_idx" ON "suppression_list"("business_line_id");

-- CreateIndex
CREATE INDEX "suppression_list_email_idx" ON "suppression_list"("email");

-- CreateIndex
CREATE INDEX "suppression_list_domain_idx" ON "suppression_list"("domain");

-- CreateIndex
CREATE INDEX "suppression_list_google_place_id_idx" ON "suppression_list"("google_place_id");

-- CreateIndex
CREATE INDEX "suppression_list_instagram_handle_idx" ON "suppression_list"("instagram_handle");

-- CreateIndex
CREATE INDEX "batches_business_line_id_idx" ON "batches"("business_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targeting_profiles" ADD CONSTRAINT "targeting_profiles_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_drafts" ADD CONSTRAINT "dm_drafts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sends" ADD CONSTRAINT "sends_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sends" ADD CONSTRAINT "sends_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_sends" ADD CONSTRAINT "dm_sends_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_sends" ADD CONSTRAINT "dm_sends_dm_draft_id_fkey" FOREIGN KEY ("dm_draft_id") REFERENCES "dm_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_send_id_fkey" FOREIGN KEY ("send_id") REFERENCES "sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_drafts" ADD CONSTRAINT "reply_drafts_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "replies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "targeting_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
