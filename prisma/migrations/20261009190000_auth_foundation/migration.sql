-- Auth, audit, and API tokens live in public.
-- Health and food stay in personal so later records are not mixed with credentials.

CREATE SCHEMA IF NOT EXISTS "personal";

CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

CREATE TABLE "public"."webauthn_credentials" (
    "credential_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("credential_id")
);

CREATE TABLE "public"."totp_secrets" (
    "user_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    CONSTRAINT "totp_secrets_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reauth_at" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id");

CREATE TABLE "public"."auth_challenges" (
    "id" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_challenges_challenge_key" ON "public"."auth_challenges"("challenge");

CREATE TABLE "public"."audit_log" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "actor" TEXT,
    "subject" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_log_source_check" CHECK ("source" IN ('web', 'voice', 'api')),
    CONSTRAINT "audit_log_outcome_check" CHECK ("outcome" IN ('success', 'failure'))
);

CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log"("created_at");

CREATE TABLE "public"."api_tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "public"."api_tokens"("token_hash");
CREATE INDEX "api_tokens_name_idx" ON "public"."api_tokens"("name");

CREATE TABLE "public"."login_attempts" (
    "id" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personal"."health_entries" (
    "id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personal"."food_entries" (
    "id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "food_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."webauthn_credentials"
  ADD CONSTRAINT "webauthn_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."totp_secrets"
  ADD CONSTRAINT "totp_secrets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
