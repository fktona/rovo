CREATE TYPE "public"."attestation_kind" AS ENUM('self_rove', 'scout', 'claim');--> statement-breakpoint
CREATE TABLE "identity_attestations" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "attestation_kind" NOT NULL,
	"nonce" text NOT NULL,
	"x_user_id" bigint NOT NULL,
	"handle" text NOT NULL,
	"recipient" text,
	"profile_token" text,
	"metadata_hash" text,
	"verifying_contract" text NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_identities" (
	"privy_user_id" text PRIMARY KEY NOT NULL,
	"x_user_id" bigint NOT NULL,
	"handle" text NOT NULL,
	"wallet" text NOT NULL,
	"x_verified_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "identity_attestations_nonce_uidx" ON "identity_attestations" USING btree ("nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "verified_identities_x_user_uidx" ON "verified_identities" USING btree ("x_user_id");