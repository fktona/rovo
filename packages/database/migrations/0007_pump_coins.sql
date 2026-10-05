CREATE TABLE "pump_coins" (
	"mint" text PRIMARY KEY NOT NULL,
	"name" text,
	"symbol" text,
	"image_url" text,
	"metadata_uri" text,
	"quote_mint" text,
	"launcher_wallet" text,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pump_coins_created_at_idx" ON "pump_coins" USING btree ("created_at");
