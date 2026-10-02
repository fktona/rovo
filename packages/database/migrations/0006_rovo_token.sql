CREATE TABLE "rovo_token" (
	"id" integer PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
