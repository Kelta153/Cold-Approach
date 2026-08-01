-- CreateTable
CREATE TABLE "automation_states" (
    "id" TEXT NOT NULL,
    "business_line_id" TEXT NOT NULL,
    "redis_failure_count" INTEGER NOT NULL DEFAULT 0,
    "redis_cooldown_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_states_business_line_id_key" ON "automation_states"("business_line_id");

-- AddForeignKey
ALTER TABLE "automation_states" ADD CONSTRAINT "automation_states_business_line_id_fkey" FOREIGN KEY ("business_line_id") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
