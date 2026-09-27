import { PrivyClient, type User } from "@privy-io/node";
import { normalizeHandle } from "./memory.js";
import type { Address, IdentityVerifier, VerifiedXIdentity } from "./types.js";

type PrivyIdentityClient = {
  verifyAccessToken(accessToken: string): Promise<{ user_id: string }>;
  getUser(userId: string): Promise<User>;
};

export class PrivyIdentityVerifier implements IdentityVerifier {
  constructor(private readonly client: PrivyIdentityClient) {}

  async verify(
    accessToken: string,
    wallet: Address,
  ): Promise<VerifiedXIdentity> {
    const claims = await this.client.verifyAccessToken(accessToken);
    console.log("claims", claims);
    const user = await this.client.getUser(claims.user_id);
    console.log("user", user);
    if (user.id !== claims.user_id) throw new Error("Privy user mismatch");

    const twitter = user.linked_accounts.find(
      (account) => account.type === "twitter_oauth",
    );
    console.log("twitter", twitter);
    if (!twitter?.username || !/^\d+$/.test(twitter.subject)) {
      throw new Error(
        "A verified X account with a numeric subject is required",
      );
    }

    // const normalizedWallet = wallet.toLowerCase();
    // const ownsWallet = user.linked_accounts.some(
    //   (account) =>
    //     (account.type === "wallet" || account.type === "smart_wallet") &&
    //     account.address.toLowerCase() === normalizedWallet,
    // );
    // if (!ownsWallet)
    //   throw new Error("Wallet is not linked to the authenticated Privy user");

    return {
      privyUserId: user.id,
      xUserId: twitter.subject,
      handle: normalizeHandle(twitter.username),
      wallet,
      verifiedAt: new Date(twitter.verified_at * 1_000),
    };
  }
}

export function createPrivyIdentityVerifier(config: {
  appId: string;
  appSecret: string;
  jwtVerificationKey?: string;
}): PrivyIdentityVerifier {
  const client = new PrivyClient({
    appId: config.appId,
    appSecret: config.appSecret,
    ...(config.jwtVerificationKey
      ? { jwtVerificationKey: config.jwtVerificationKey }
      : {}),
  });
  return new PrivyIdentityVerifier({
    verifyAccessToken: (accessToken) =>
      client.utils().auth().verifyAccessToken(accessToken),
    getUser: (userId) => client.users()._get(userId),
  });
}
