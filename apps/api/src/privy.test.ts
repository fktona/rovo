import type { User } from "@privy-io/node";
import { describe, expect, it } from "vitest";
import { PrivyIdentityVerifier } from "./privy.js";

const wallet = "0x1111111111111111111111111111111111111111" as const;

function user(overrides: Partial<User> = {}): User {
  return {
    id: "did:privy:alice",
    created_at: 1,
    has_accepted_terms: true,
    is_guest: false,
    mfa_methods: [],
    linked_accounts: [
      {
        type: "twitter_oauth",
        subject: "123456789",
        username: "@Alice",
        name: "Alice",
        profile_picture_url: null,
        verified_at: 1_700_000_000,
        first_verified_at: 1_700_000_000,
        latest_verified_at: 1_700_000_000,
      },
      {
        type: "wallet",
        address: wallet,
        chain_type: "ethereum",
        verified_at: 1_700_000_000,
        first_verified_at: 1_700_000_000,
        latest_verified_at: 1_700_000_000,
        wallet_client: "unknown",
      },
    ],
    ...overrides,
  };
}

describe("PrivyIdentityVerifier", () => {
  it("binds the authenticated Privy user to its verified X ID and selected wallet", async () => {
    const verifier = new PrivyIdentityVerifier({
      verifyAccessToken: async () => ({ user_id: "did:privy:alice" }),
      getUser: async () => user(),
    });
    await expect(verifier.verify("valid-token", wallet)).resolves.toMatchObject(
      {
        privyUserId: "did:privy:alice",
        xUserId: "123456789",
        handle: "alice",
        wallet,
      },
    );
  });

  it("rejects a wallet that is not linked to the authenticated user", async () => {
    const verifier = new PrivyIdentityVerifier({
      verifyAccessToken: async () => ({ user_id: "did:privy:alice" }),
      getUser: async () => user(),
    });
    await expect(
      verifier.verify(
        "valid-token",
        "0x2222222222222222222222222222222222222222",
      ),
    ).rejects.toThrow("Wallet is not linked");
  });

  it("rejects an X account without the stable numeric subject", async () => {
    const invalid = user();
    invalid.linked_accounts = invalid.linked_accounts.map((account) =>
      account.type === "twitter_oauth"
        ? { ...account, subject: "alice" }
        : account,
    );
    const verifier = new PrivyIdentityVerifier({
      verifyAccessToken: async () => ({ user_id: "did:privy:alice" }),
      getUser: async () => invalid,
    });
    await expect(verifier.verify("valid-token", wallet)).rejects.toThrow(
      "numeric subject",
    );
  });
});
