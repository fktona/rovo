import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@rovo/api",
    "exec",
    "vitest",
    "run",
    "src/attestations.test.ts",
    "src/x.test.ts",
  ],
  {
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const migrationDirectory = "packages/database/migrations";
const sql = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(`${migrationDirectory}/${name}`, "utf8"))
  .join("\n");
for (const required of [
  'CREATE TABLE "identity_attestations"',
  'CREATE TABLE "verified_identities"',
  "identity_attestations_nonce_uidx",
  "verified_identities_x_user_uidx",
]) {
  if (!sql.includes(required))
    throw new Error(`Migration is missing ${required}`);
}
console.log("attestation persistence verified");
