import { spawnSync } from "node:child_process";

for (const [command, args] of [
  ["pnpm", ["--filter", "@rovo/database", "exec", "drizzle-kit", "check"]],
  ["pnpm", ["typecheck"]],
  ["pnpm", ["test"]],
  ["pnpm", ["build"]],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("identity deployment integration verified");
