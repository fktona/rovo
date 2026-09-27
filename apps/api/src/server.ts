import { buildServer } from "./app.js";
import { envSchema } from "@rovo/config";
import { createDatabase } from "@rovo/database";
import { PostgresRovoRepository } from "./postgres.js";
import { createPrivyIdentityVerifier } from "./privy.js";
import { IdentityAttestationService } from "./attestations.js";
import { XApiProfileResolver } from "./x.js";
import { selectXTokens, XOAuth } from "./x-auth.js";
import { loadXOauthTokens, saveXOauthTokens } from "./x-tokens.js";
import { createLaunchSyncClient, indexLaunchImmediately, runLaunchSync } from "./launch-sync.js";

const env = envSchema.parse(process.env);
const { db, pool } = createDatabase(env.DATABASE_URL);
const repository = new PostgresRovoRepository(db);
const identityVerifier = createPrivyIdentityVerifier({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
});
const storedXTokens = await loadXOauthTokens(db);
const xTokens = selectXTokens({
  stored: storedXTokens,
  envAccessToken: env.X_API_BEARER_TOKEN,
  envRefreshToken: env.X_API_REFRESH_TOKEN,
});
const xResolver = new XApiProfileResolver(
  new XOAuth({
    accessToken: xTokens.accessToken,
    refreshToken: xTokens.refreshToken,
    expiresAt: xTokens.expiresAt,
    clientId: env.X_API_CLIENT_ID,
    clientSecret: env.X_API_CLIENT_SECRET,
    save: (tokens) => saveXOauthTokens(db, tokens),
  }),
);
const attestationService = new IdentityAttestationService({
  privateKey: env.IDENTITY_SIGNER_PRIVATE_KEY as `0x${string}`,
  chainId: 4663,
  wrapper: env.ROVO_FACTORY_WRAPPER_ADDRESS as `0x${string}`,
  nottingham: env.ROVO_NOTTINGHAM_ADDRESS as `0x${string}`,
  identityVerifier,
  xResolver,
  repository,
  store: repository,
});
const launchSyncAbort = new AbortController();
const registry = process.env.ROVO_REGISTRY_ADDRESS;
const startBlock = process.env.ROVO_START_BLOCK;
if (!registry || !/^0x[a-fA-F0-9]{40}$/.test(registry) || !startBlock || !/^\d+$/.test(startBlock)) {
  throw new Error("ROVO_REGISTRY_ADDRESS and ROVO_START_BLOCK are required for launch sync");
}
const launchClient = createLaunchSyncClient(process.env.PONDER_RPC_URL_4663 ?? env.ROBINHOOD_RPC_URL);
const registryAddress = registry as `0x${string}`;
const app = buildServer({
  repository,
  identityVerifier,
  attestationService,
  xResolver,
  recordLaunch: async (input) => {
    await indexLaunchImmediately({
      db,
      client: launchClient,
      registry: registryAddress,
      token: input.token,
      transactionHash: input.transactionHash,
      ...(input.handle ? { handle: input.handle } : {}),
    });
    const saved = await repository.getLaunch(input.token);
    if (!saved) throw new Error("Indexed launch was not saved");
    return saved;
  },
});
app.addHook("onClose", async () => {
  launchSyncAbort.abort();
  await pool.end();
});
await app.listen({ host: "0.0.0.0", port: env.PORT });
void runLaunchSync({
  db,
  client: launchClient,
  registry: registryAddress,
  startBlock: BigInt(startBlock),
}, launchSyncAbort.signal);
