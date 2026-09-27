import { z } from "zod";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
});

export type XTokenSource = {
  getAccessToken: () => Promise<string>;
  refresh?: () => Promise<string>;
};

/** X user tokens are sometimes pasted as base64. Keep a raw access or refresh token as-is. */
export function unwrapXToken(value: string): string {
  const trimmed = value.trim();
  if (isXUserToken(trimmed)) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (isXUserToken(decoded)) return decoded;
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function xTokenExpiresAt(token: string): number | null {
  const stamp = unwrapXToken(token)
    .split(":")
    .find((part) => /^\d{13}$/.test(part));
  return stamp ? Number(stamp) : null;
}

function isXUserToken(value: string) {
  return /:(at|rt):\d+$/.test(value);
}

export async function refreshXUserToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string | undefined;
  fetcher?: typeof fetch;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const refreshToken = input.refreshToken.trim();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: input.clientId,
  });
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  if (input.clientSecret) {
    headers.authorization = `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64")}`;
  }
  const response = await (input.fetcher ?? fetch)("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error_description" in payload
        ? String(payload.error_description)
        : `status ${response.status}`;
    throw new Error(`X token refresh failed: ${detail}`);
  }
  const parsed = tokenResponseSchema.parse(payload);
  const expiresIn = parsed.expires_in ?? 7200;
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export type StoredXTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

/** Prefer a saved pair. A newer access token in the environment replaces it. */
export function selectXTokens(input: {
  stored: StoredXTokens | null;
  envAccessToken: string;
  envRefreshToken?: string | undefined;
}): StoredXTokens {
  const envAccess = input.envAccessToken.trim();
  const envExpires = xTokenExpiresAt(envAccess) ?? 0;
  if (!input.stored || envExpires > input.stored.expiresAt) {
    return {
      accessToken: envAccess,
      refreshToken: input.envRefreshToken?.trim() ?? "",
      expiresAt: envExpires,
    };
  }
  return {
    accessToken: input.stored.accessToken,
    refreshToken: input.stored.refreshToken,
    expiresAt: input.stored.expiresAt,
  };
}

export class XOAuth implements XTokenSource {
  private accessToken: string;
  private refreshToken: string | null;
  private expiresAt: number;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly options: {
      accessToken: string;
      refreshToken?: string | undefined;
      clientId?: string | undefined;
      clientSecret?: string | undefined;
      expiresAt?: number | undefined;
      save?: ((tokens: StoredXTokens) => Promise<void>) | undefined;
      fetcher?: typeof fetch;
      now?: () => number;
    },
  ) {
    this.accessToken = options.accessToken.trim();
    this.refreshToken = options.refreshToken?.trim() ? options.refreshToken.trim() : null;
    this.expiresAt = options.expiresAt ?? xTokenExpiresAt(this.accessToken) ?? 0;
  }

  async getAccessToken() {
    if (this.refreshToken && this.expiring()) await this.refresh();
    return this.accessToken;
  }

  async refresh() {
    if (!this.pending) {
      this.pending = this.refreshOnce().finally(() => {
        this.pending = null;
      });
    }
    await this.pending;
    return this.accessToken;
  }

  private expiring() {
    return (this.options.now ?? Date.now)() >= this.expiresAt - 60_000;
  }

  private async refreshOnce() {
    if (!this.refreshToken) throw new Error("X refresh token is not configured");
    if (!this.options.clientId) {
      throw new Error("X user token expired. Set X_API_CLIENT_ID to refresh it.");
    }
    const next = await refreshXUserToken({
      refreshToken: this.refreshToken,
      clientId: this.options.clientId,
      ...(this.options.clientSecret ? { clientSecret: this.options.clientSecret } : {}),
      ...(this.options.fetcher ? { fetcher: this.options.fetcher } : {}),
    });
    this.accessToken = next.accessToken;
    this.refreshToken = next.refreshToken;
    this.expiresAt = next.expiresAt;
    if (!this.refreshToken) return;
    try {
      await this.options.save?.({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
      });
    } catch (error) {
      throw new Error("X token refreshed but the new pair could not be saved", { cause: error });
    }
  }
}
