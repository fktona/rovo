CREATE TYPE "public"."launch_type" AS ENUM('scout', 'self');--> statement-breakpoint
CREATE TYPE "public"."revenue_state" AS ENUM('unswept', 'swept_unclaimed', 'distributed');--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"finalized_block" bigint NOT NULL,
	"finalized_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"token" text PRIMARY KEY NOT NULL,
	"curve" text NOT NULL,
	"pair_token" text NOT NULL,
	"fee_collector" text NOT NULL,
	"pons_factory" text NOT NULL,
	"pons_fee_escrow" text NOT NULL,
	"pons_meme_hook" text NOT NULL,
	"x_user_id" bigint NOT NULL,
	"handle" text NOT NULL,
	"type" "launch_type" NOT NULL,
	"rover" text,
	"creator" text,
	"creator_tax_bps" integer NOT NULL,
	"claimed" boolean NOT NULL,
	"launched_at" timestamp with time zone NOT NULL,
	"block_number" bigint NOT NULL,
	"transaction_hash" text NOT NULL,
	CONSTRAINT "launches_fee_collector_unique" UNIQUE("fee_collector")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"x_user_id" bigint PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"image_url" text,
	"privy_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"profile_token" text NOT NULL,
	"asset" text NOT NULL,
	"amount" bigint NOT NULL,
	"state" "revenue_state" NOT NULL,
	"block_number" bigint NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "revenue_events_tx_hash_log_index_pk" PRIMARY KEY("tx_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "reward_epochs" (
	"profile_token" text NOT NULL,
	"epoch_id" bigint NOT NULL,
	"stock_token" text NOT NULL,
	"merkle_root" text NOT NULL,
	"total_amount" bigint NOT NULL,
	"snapshot_block" bigint NOT NULL,
	"metadata_uri" text NOT NULL,
	CONSTRAINT "reward_epochs_profile_token_epoch_id_pk" PRIMARY KEY("profile_token","epoch_id")
);
--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_x_user_id_profiles_x_user_id_fk" FOREIGN KEY ("x_user_id") REFERENCES "public"."profiles"("x_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "launches_x_user_uidx" ON "launches" USING btree ("x_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "launches_handle_uidx" ON "launches" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_uidx" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "revenue_profile_idx" ON "revenue_events" USING btree ("profile_token");