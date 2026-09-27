CREATE TABLE "reward_proofs" (
	"profile_token" text NOT NULL,
	"epoch_id" bigint NOT NULL,
	"account" text NOT NULL,
	"amount" bigint NOT NULL,
	"proof" jsonb NOT NULL,
	CONSTRAINT "reward_proofs_profile_token_epoch_id_account_pk" PRIMARY KEY("profile_token","epoch_id","account")
);
--> statement-breakpoint
ALTER TABLE "reward_epochs" ADD COLUMN "snapshot_block_hash" text DEFAULT '0x' NOT NULL;--> statement-breakpoint
CREATE INDEX "reward_proofs_account_idx" ON "reward_proofs" USING btree ("account");