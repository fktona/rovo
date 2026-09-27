import { defineChain } from "viem";
import { z } from "zod";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ROBINHOOD_RPC_URL: z.url().default("https://rpc.mainnet.chain.robinhood.com"),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  IDENTITY_SIGNER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  X_API_BEARER_TOKEN: z.string().min(1),
  X_API_REFRESH_TOKEN: z.string().min(1).optional(),
  X_API_CLIENT_ID: z.string().min(1).optional(),
  X_API_CLIENT_SECRET: z.string().min(1).optional(),
  ROVO_FACTORY_WRAPPER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ROVO_NOTTINGHAM_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  REDIS_URL: z.url().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type RovoEnv = z.infer<typeof envSchema>;
