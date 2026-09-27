import { describe, expect, it } from "vitest";
import { XApiProfileResolver } from "./x.js";
import { refreshXUserToken, selectXTokens, unwrapXToken, XOAuth } from "./x-auth.js";

const access = "access-secret:1790000000000:1:0:at:1";
const refresh = "refresh-secret:1790000000000:1:0:rt:1";

describe("unwrapXToken", () => {
  it("decodes a base64-wrapped X user token", () => {
    expect(unwrapXToken(Buffer.from(access).toString("base64"))).toBe(access);
    expect(unwrapXToken(access)).toBe(access);
    expect(unwrapXToken("plain-app-token")).toBe("plain-app-token");
  });
});

describe("refreshXUserToken", () => {
  it("sends the refresh grant and keeps a rotated refresh token", async () => {
    const storedRefresh = Buffer.from(refresh).toString("base64");
    const result = await refreshXUserToken({
      refreshToken: storedRefresh,
      clientId: "client",
      clientSecret: "secret",
      fetcher: async (input, init) => {
        expect(String(input)).toBe("https://api.x.com/2/oauth2/token");
        expect(init?.method).toBe("POST");
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe(
          `Basic ${Buffer.from("client:secret").toString("base64")}`,
        );
        expect(String(init?.body)).toContain("grant_type=refresh_token");
        expect(String(init?.body)).toContain("client_id=client");
        expect(String(init?.body)).toContain(
          `refresh_token=${encodeURIComponent(storedRefresh)}`,
        );
        return Response.json({
          access_token: "next-access:1990000000000:1:0:at:1",
          refresh_token: "next-refresh:1990000000000:1:0:rt:1",
          expires_in: 7200,
        });
      },
    });
    expect(result.accessToken).toContain(":at:1");
    expect(result.refreshToken).toContain(":rt:1");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("selectXTokens", () => {
  it("keeps a saved pair until the environment token expires later", () => {
    const stored = {
      accessToken: "saved-access",
      refreshToken: "saved-refresh",
      expiresAt: 1790000000001,
    };
    expect(
      selectXTokens({ stored, envAccessToken: access, envRefreshToken: refresh }),
    ).toEqual(stored);
    expect(
      selectXTokens({
        stored,
        envAccessToken: "newer-access:1990000000000:1:0:at:1",
        envRefreshToken: "newer-refresh",
      }),
    ).toEqual({
      accessToken: "newer-access:1990000000000:1:0:at:1",
      refreshToken: "newer-refresh",
      expiresAt: 1990000000000,
    });
  });
});

describe("XOAuth", () => {
  it("replaces a base64 token pair and stores the decoded values", async () => {
    const saved: Array<{ accessToken: string; refreshToken: string; expiresAt: number }> = [];
    const oauth = new XOAuth({
      accessToken: access,
      refreshToken: refresh,
      clientId: "client",
      now: () => 1_700_000_000_000,
      save: async (tokens) => {
        saved.push(tokens);
      },
    });
    const nextAccess = Buffer.from("next-access:1990000000000:1:0:at:1").toString("base64");
    const nextRefresh = Buffer.from("next-refresh:1990000000000:1:0:rt:1").toString("base64");
    await expect(oauth.replace(nextAccess, nextRefresh)).resolves.toEqual({
      expiresAt: new Date(1990000000000).toISOString(),
    });
    expect(saved[0]?.accessToken).toBe("next-access:1990000000000:1:0:at:1");
    expect(saved[0]?.refreshToken).toBe("next-refresh:1990000000000:1:0:rt:1");
    await expect(oauth.getAccessToken()).resolves.toBe("next-access:1990000000000:1:0:at:1");
  });

  it("refreshes an expired access token and saves the new pair", async () => {
    const saved: unknown[] = [];
    const oauth = new XOAuth({
      accessToken: access,
      refreshToken: refresh,
      clientId: "client",
      now: () => 1790000000000,
      save: async (tokens) => {
        saved.push(tokens);
      },
      fetcher: async () =>
        Response.json({
          access_token: "fresh-access:1990000000000:1:0:at:1",
          refresh_token: "fresh-refresh:1990000000000:1:0:rt:1",
          expires_in: 100,
        }),
    });
    await expect(oauth.getAccessToken()).resolves.toBe(
      "fresh-access:1990000000000:1:0:at:1",
    );
    expect(saved).toEqual([
      {
        accessToken: "fresh-access:1990000000000:1:0:at:1",
        refreshToken: "fresh-refresh:1990000000000:1:0:rt:1",
        expiresAt: expect.any(Number),
      },
    ]);
  });
});

describe("XApiProfileResolver auth retry", () => {
  it("refreshes once after X rejects the access token", async () => {
    const headers: string[] = [];
    let token = "expired";
    const resolver = new XApiProfileResolver(
      {
        async getAccessToken() {
          return token;
        },
        async refresh() {
          token = "fresh";
          return token;
        },
      },
      async (_input, init) => {
        const authorization = new Headers(init?.headers).get("authorization") ?? "";
        headers.push(authorization);
        if (authorization.endsWith("expired")) return new Response("no", { status: 401 });
        return Response.json({
          data: [{ id: "7", username: "blu", name: "Blu" }],
        });
      },
    );
    await expect(resolver.search("blu")).resolves.toMatchObject([
      { handle: "blu", xUserId: "7" },
    ]);
    expect(headers).toEqual(["Bearer expired", "Bearer fresh"]);
  });
});
