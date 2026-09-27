import type { Address, Hex } from "viem";
import { asAddress, asBytes32, normalizeHandle } from "./validation";

export type ScoutProfile = {
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  token: Address | null;
};

export type LaunchView = {
  token: Address;
  handle: string;
  xUserId: string;
  pairToken: Address;
  feeCollector: Address;
  launchType: "scout" | "self";
  rover: Address | null;
  scout: ScoutProfile | null;
  claimed: boolean;
  creatorTaxBps: number;
  displayName: string | null;
  imageUrl: string | null;
  launchedAt: string;
};
export type XAccountView = {
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  followers: number | null;
  verified: boolean;
};
export type ProfileView = {
  xUserId: string;
  handle: string;
  displayName: string | null;
  imageUrl: string | null;
  token: Address;
};
export type RewardClaimView = {
  profileToken: Address;
  epochId: string;
  stockToken: Address;
  amount: string;
  proof: Hex[];
  merkleRoot: Hex;
  snapshotBlock: string;
  metadataUri: string;
};
export type IssuedAttestation = {
  id: string;
  kind: "self_rove" | "scout" | "claim";
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  primaryType:
    "SelfRoveAttestation" | "ScoutProfileAttestation" | "ClaimAttestation";
  types: Record<string, readonly { name: string; type: string }[]>;
  message: Record<string, string>;
  signature: Hex;
};
export type VerifiedXIdentity = {
  privyUserId: string;
  xUserId: string;
  handle: string;
  wallet: Address;
  verifiedAt: string;
};

export class RovoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RovoApiError";
  }
}

export class RovoApiClient {
  constructor(
    readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!/^https?:\/\//.test(baseUrl))
      throw new Error("API base URL must be HTTP(S)");
  }

  private async request<T>(
    path: string,
    options: {
      body?: unknown;
      token?: string;
      signal?: AbortSignal | undefined;
    } = {},
  ): Promise<T> {
    const response = await this.fetcher.call(
      globalThis,
      `${this.baseUrl.replace(/\/+$/, "")}${path}`,
      {
        method: options.body === undefined ? "GET" : "POST",
        headers: {
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        ...(options.signal ? { signal: options.signal } : {}),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new RovoApiError(
        response.status,
        payload?.error ?? `API request failed (${response.status})`,
      );
    }
    return response.json() as Promise<T>;
  }

  health(signal?: AbortSignal) {
    return this.request<{ status: "ok"; service: string }>("/health", {
      signal,
    });
  }
  launch(token: Address, signal?: AbortSignal) {
    return this.request<LaunchView>(`/v1/launches/${asAddress(token)}`, {
      signal,
    });
  }
  recordLaunch(input: {
    token: Address;
    transactionHash: Hex;
    handle: string;
  }) {
    return this.request<LaunchView>("/v1/launches/index", {
      body: {
        token: asAddress(input.token),
        transactionHash: asBytes32(input.transactionHash, "transaction"),
        handle: normalizeHandle(input.handle),
      },
    });
  }
  launches(limit = 50, signal?: AbortSignal) {
    return this.request<{ launches: LaunchView[] }>(
      `/v1/launches?limit=${Math.min(100, Math.max(1, limit))}`,
      { signal },
    );
  }
  xAccount(handle: string, signal?: AbortSignal) {
    return this.request<XAccountView>(
      `/v1/x/${encodeURIComponent(normalizeHandle(handle))}`,
      { signal },
    );
  }
  searchXAccounts(query: string, signal?: AbortSignal) {
    const text = query.trim().replace(/^@+/, "");
    return this.request<{ accounts: XAccountView[] }>(
      `/v1/x/search?q=${encodeURIComponent(text)}`,
      { signal },
    );
  }
  profile(handle: string, signal?: AbortSignal) {
    return this.request<ProfileView>(
      `/v1/profiles/${encodeURIComponent(normalizeHandle(handle))}`,
      { signal },
    );
  }
  rewards(token: Address, account: Address, signal?: AbortSignal) {
    return this.request<{ claims: RewardClaimView[] }>(
      `/v1/rewards/${asAddress(token)}/${asAddress(account)}`,
      { signal },
    );
  }
  verifyX(token: string, wallet: Address) {
    return this.request<VerifiedXIdentity>("/v1/identity/x/verify", {
      token,
      body: { wallet: asAddress(wallet) },
    });
  }
  selfRoveAttestation(token: string, wallet: Address, metadataHash: Hex) {
    return this.request<IssuedAttestation>("/v1/attestations/self-rove", {
      token,
      body: {
        wallet: asAddress(wallet),
        metadataHash: asBytes32(metadataHash),
      },
    });
  }
  scoutAttestation(handle: string, metadataHash: Hex) {
    return this.request<IssuedAttestation>("/v1/attestations/scout", {
      body: {
        handle: normalizeHandle(handle),
        metadataHash: asBytes32(metadataHash),
      },
    });
  }
  claimAttestation(token: string, wallet: Address, profileToken: Address) {
    return this.request<IssuedAttestation>("/v1/attestations/claim", {
      token,
      body: {
        wallet: asAddress(wallet),
        profileToken: asAddress(profileToken),
      },
    });
  }
}
