import { z } from "zod";
import { normalizeHandle } from "./memory.js";
import type { XTokenSource } from "./x-auth.js";
import type { PublicXProfile, PublicXProfileResolver } from "./types.js";

const userSchema = z.object({
  id: z.string().regex(/^\d+$/),
  username: z.string().min(1),
  name: z.string().nullable().optional(),
  profile_image_url: z.url().nullable().optional(),
  public_metrics: z
    .object({ followers_count: z.number().int().nonnegative() })
    .optional(),
  verified: z.boolean().nullish(),
  verified_type: z.string().nullish(),
});

const userFields =
  "id,name,username,profile_image_url,public_metrics,verified,verified_type";

function isVerified(user: z.infer<typeof userSchema>) {
  if (user.verified === true) return true;
  return (
    user.verified_type === "blue" ||
    user.verified_type === "business" ||
    user.verified_type === "government"
  );
}

const responseSchema = z.object({
  data: userSchema,
});

const searchSchema = z.object({
  data: z.array(z.unknown()).optional(),
});

function toProfile(user: z.infer<typeof userSchema>): PublicXProfile {
  return {
    xUserId: user.id,
    handle: normalizeHandle(user.username),
    displayName: user.name ?? null,
    imageUrl: user.profile_image_url ?? null,
    followers: user.public_metrics?.followers_count ?? null,
    verified: isVerified(user),
  };
}

export class XApiProfileResolver implements PublicXProfileResolver {
  constructor(
    private readonly tokens: string | XTokenSource,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async resolve(handle: string): Promise<PublicXProfile> {
    const normalized = normalizeHandle(handle);
    const url = new URL(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(normalized)}`,
    );
    url.searchParams.set("user.fields", userFields);
    const response = await this.request(url);
    if (!response.ok)
      throw new Error(`X profile lookup failed with status ${response.status}`);
    const parsed = responseSchema.parse(await response.json());
    return toProfile(parsed.data);
  }

  async search(query: string): Promise<PublicXProfile[]> {
    const text = query.trim().replace(/^@+/, "").slice(0, 50);
    if (text.length < 2) return [];
    const url = new URL("https://api.x.com/2/users/search");
    url.searchParams.set("query", text);
    url.searchParams.set("max_results", "8");
    url.searchParams.set("user.fields", userFields);
    const response = await this.request(url);
    if (!response.ok)
      throw new Error(`X user search failed with status ${response.status}`);
    const parsed = searchSchema.parse(await response.json());
    const accounts: PublicXProfile[] = [];
    for (const user of parsed.data ?? []) {
      const item = userSchema.safeParse(user);
      if (!item.success) continue;
      try {
        accounts.push(toProfile(item.data));
      } catch {
        continue;
      }
    }
    return accounts;
  }

  private async request(url: URL, refreshed = false): Promise<Response> {
    const response = await this.fetcher(url, {
      headers: { authorization: `Bearer ${await this.accessToken()}`, accept: "application/json" },
    });
    if (response.ok || refreshed || typeof this.tokens === "string" || !this.tokens.refresh) {
      return response;
    }
    if (response.status !== 401 && response.status !== 403) return response;
    await this.tokens.refresh();
    return this.request(url, true);
  }

  private accessToken() {
    return typeof this.tokens === "string" ? Promise.resolve(this.tokens) : this.tokens.getAccessToken();
  }
}
