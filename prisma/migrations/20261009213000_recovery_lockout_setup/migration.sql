-- AlterTable
ALTER TABLE "public"."login_attempts" ADD COLUMN "locked_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."owner_state" (
    "id" INTEGER NOT NULL,
    "setup_completed_at" TIMESTAMP(3),

    CONSTRAINT "owner_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_code_hash_key" ON "public"."recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "public"."recovery_codes"("user_id");

-- AddForeignKey
ALTER TABLE "public"."recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
