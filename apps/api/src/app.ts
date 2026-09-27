import Fastify from "fastify";
import { z } from "zod";
import { normalizeHandle } from "./memory.js";
import { LaunchIndexError } from "./launch-sync.js";
import type {
  Address,
  IdentityVerifier,
  LaunchView,
  PublicXProfileResolver,
  RovoRepository,
} from "./types.js";
import type { IdentityAttestationService } from "./attestations.js";

const addressSchema = z.custom<Address>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value),
);
const bytes32Schema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value),
);

export function buildServer(deps: {
  repository: RovoRepository;
  identityVerifier: IdentityVerifier;
  attestationService: Pick<
    IdentityAttestationService,
    "issueSelfRove" | "issueScout" | "issueClaim"
  >;
  xResolver?: PublicXProfileResolver;
  recordLaunch?: (input: {
    token: Address;
    transactionHash: `0x${string}`;
    handle?: string;
  }) => Promise<LaunchView>;
}) {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigin =
      process.env.ROVO_WEB_ORIGIN ?? "http://localhost:3000";
    if (origin === allowedOrigin) {
      reply.header("Access-Control-Allow-Origin", allowedOrigin);
      reply.header("Vary", "Origin");
      reply.header(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
  });
  app.options("/*", async (_request, reply) => reply.code(204).send());

  app.get("/health", async () => ({ status: "ok", service: "rovo-api" }));

  app.get("/v1/launches", async (request, reply) => {
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .safeParse(request.query);
    if (!query.success)
      return reply.code(400).send({ error: "invalid launch limit" });
    return { launches: await deps.repository.listLaunches(query.data.limit) };
  });

  app.post("/v1/launches/index", async (request, reply) => {
    if (!deps.recordLaunch) {
      return reply.code(503).send({ error: "launch indexing unavailable" });
    }
    const body = z
      .object({
        token: addressSchema,
        transactionHash: bytes32Schema,
        handle: z.string().trim().min(1).max(16).optional(),
      })
      .safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid launch index request" });
    }
    try {
      return await deps.recordLaunch({
        token: body.data.token,
        transactionHash: body.data.transactionHash,
        ...(body.data.handle ? { handle: body.data.handle } : {}),
      });
    } catch (error) {
      if (error instanceof LaunchIndexError) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(503).send({ error: "launch could not be saved" });
    }
  });

  app.get("/v1/launches/:token", async (request, reply) => {
    const parsed = addressSchema.safeParse(
      (request.params as { token: string }).token,
    );
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid token address" });
    const launch = await deps.repository.getLaunch(parsed.data);
    if (!launch) return reply.code(404).send({ error: "launch not found" });
    return launch;
  });

  app.get("/v1/x/search", async (request, reply) => {
    if (!deps.xResolver)
      return reply.code(503).send({ error: "x lookup unavailable" });
    const query = z
      .object({ q: z.string().trim().min(1).max(50) })
      .safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid x search" });
    const text = query.data.q.replace(/^@+/, "");
    if (text.length < 2) return reply.code(400).send({ error: "invalid x search" });
    try {
      const accounts = await deps.xResolver.search(text);
      return {
        accounts: accounts.map((profile) => ({
          handle: profile.handle,
          displayName: profile.displayName,
          imageUrl: profile.imageUrl,
          followers: profile.followers ?? null,
          verified: profile.verified === true,
        })),
      };
    } catch {
      return reply.code(503).send({ error: "x search unavailable" });
    }
  });

  app.get("/v1/x/:handle", async (request, reply) => {
    if (!deps.xResolver)
      return reply.code(503).send({ error: "x lookup unavailable" });
    try {
      const profile = await deps.xResolver.resolve(
        (request.params as { handle: string }).handle,
      );
      return {
        handle: profile.handle,
        displayName: profile.displayName,
        imageUrl: profile.imageUrl,
        followers: profile.followers ?? null,
        verified: profile.verified === true,
      };
    } catch {
      return reply.code(404).send({ error: "x profile not found" });
    }
  });

  app.get("/v1/profiles/:handle", async (request, reply) => {
    try {
      const handle = normalizeHandle(
        (request.params as { handle: string }).handle,
      );
      const profile = await deps.repository.getProfile(handle);
      if (!profile) return reply.code(404).send({ error: "profile not found" });
      return profile;
    } catch {
      return reply.code(400).send({ error: "invalid X handle" });
    }
  });

  app.get("/v1/rewards/:token/:account", async (request, reply) => {
    const params = request.params as { token: string; account: string };
    const token = addressSchema.safeParse(params.token);
    const account = addressSchema.safeParse(params.account);
    if (!token.success || !account.success)
      return reply.code(400).send({ error: "invalid reward address" });
    return {
      claims: await deps.repository.getRewardClaims(token.data, account.data),
    };
  });

  app.post("/v1/identity/x/verify", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return reply.code(401).send({ error: "missing Privy access token" });
    const body = z.object({ wallet: addressSchema }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid wallet" });
    try {
      return await deps.identityVerifier.verify(
        auth.replace("Bearer ", ""),
        body.data.wallet,
      );
    } catch {
      return reply.code(401).send({ error: "identity verification failed" });
    }
  });

  app.post("/v1/attestations/self-rove", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return reply.code(401).send({ error: "missing Privy access token" });
    const body = z
      .object({ wallet: addressSchema, metadataHash: bytes32Schema })
      .safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: "invalid attestation request" });
    try {
      return await deps.attestationService.issueSelfRove(
        auth.slice(7),
        body.data.wallet,
        body.data.metadataHash,
      );
    } catch {
      return reply.code(401).send({ error: "identity attestation failed" });
    }
  });

  app.post("/v1/attestations/scout", async (request, reply) => {
    const body = z
      .object({
        handle: z.string().min(1).max(16),
        metadataHash: bytes32Schema,
      })
      .safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: "invalid attestation request" });
    try {
      return await deps.attestationService.issueScout(
        body.data.handle,
        body.data.metadataHash,
      );
    } catch {
      return reply.code(400).send({ error: "X profile resolution failed" });
    }
  });

  app.post("/v1/attestations/claim", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return reply.code(401).send({ error: "missing Privy access token" });
    const body = z
      .object({ wallet: addressSchema, profileToken: addressSchema })
      .safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: "invalid attestation request" });
    try {
      return await deps.attestationService.issueClaim(
        auth.slice(7),
        body.data.wallet,
        body.data.profileToken,
      );
    } catch {
      return reply
        .code(403)
        .send({ error: "claim identity does not match launch" });
    }
  });

  return app;
}
