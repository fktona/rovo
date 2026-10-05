import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { NextConfig } from "next";
import path from "node:path";

// Next only reads env files in apps/web. Fill anything still unset from the repo root .env.
loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, "../../.env"));

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const require = createRequire(import.meta.url);
const pumpSdk = require.resolve("@pump-fun/pump-sdk");
const pumpSwapSdk = require.resolve("@pump-fun/pump-swap-sdk");
const agentPaymentsSdk = createRequire(pumpSdk).resolve(
  "@pump-fun/agent-payments-sdk",
);

function projectPath(absolute: string) {
  const relative = path.relative(__dirname, absolute);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

// The ESM builds import a named BN from Anchor, which only has a CJS export.
const pumpAliases = {
  "@pump-fun/pump-sdk": projectPath(pumpSdk),
  "@pump-fun/pump-swap-sdk": projectPath(pumpSwapSdk),
  "@pump-fun/agent-payments-sdk": projectPath(agentPaymentsSdk),
};

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  env: {
    NEXT_PUBLIC_PUMP_FEE_WALLET: process.env.NEXT_PUBLIC_PUMP_FEE_WALLET,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  },
  transpilePackages: ["@raydium-io/raydium-sdk-v2"],
  turbopack: { resolveAlias: pumpAliases },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@pump-fun/pump-sdk": pumpSdk,
      "@pump-fun/pump-swap-sdk": pumpSwapSdk,
      "@pump-fun/agent-payments-sdk": agentPaymentsSdk,
    };
    return config;
  },
};

export default nextConfig;
