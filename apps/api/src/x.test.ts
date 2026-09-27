import { describe, expect, it } from "vitest";
import { XApiProfileResolver } from "./x.js";

describe("XApiProfileResolver", () => {
  it("normalizes the requested handle and returns X's stable numeric user ID", async () => {
    const resolver = new XApiProfileResolver("secret", async (input, init) => {
      expect(String(input)).toContain("/users/by/username/alice");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer secret",
      );
      return Response.json({
        data: {
          id: "123456789",
          username: "Alice",
          name: "Alice A",
          profile_image_url: "https://example.com/a.png",
          public_metrics: { followers_count: 1200 },
        },
      });
    });
    await expect(resolver.resolve("@ALICE")).resolves.toEqual({
      xUserId: "123456789",
      handle: "alice",
      displayName: "Alice A",
      imageUrl: "https://example.com/a.png",
      followers: 1200,
      verified: false,
    });
  });

  it("returns a selectable list of matching X accounts", async () => {
    const resolver = new XApiProfileResolver("secret", async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/2/users/search");
      expect(url.searchParams.get("query")).toBe("blu");
      expect(url.searchParams.get("max_results")).toBe("8");
      expect(url.searchParams.get("user.fields")).toContain("verified");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer secret",
      );
      return Response.json({
        data: [
          {
            id: "99",
            username: "BluupDotFun",
            name: "Bluup",
            profile_image_url: "https://example.com/b.png",
            public_metrics: { followers_count: 40 },
            verified_type: "blue",
          },
          { id: "not-numeric", username: "skip" },
        ],
      });
    });
    await expect(resolver.search("@blu")).resolves.toEqual([
      {
        xUserId: "99",
        handle: "bluupdotfun",
        displayName: "Bluup",
        imageUrl: "https://example.com/b.png",
        followers: 40,
        verified: true,
      },
    ]);
  });

  it("returns no accounts for a query shorter than two characters", async () => {
    const resolver = new XApiProfileResolver("secret", async () => {
      throw new Error("search should not run");
    });
    await expect(resolver.search("@")).resolves.toEqual([]);
  });

  it("rejects a response without a numeric X subject", async () => {
    const resolver = new XApiProfileResolver("secret", async () =>
      Response.json({ data: { id: "alice", username: "alice" } }),
    );
    await expect(resolver.resolve("alice")).rejects.toThrow();
  });
});
