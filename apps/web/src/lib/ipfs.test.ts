import { describe, expect, it } from "vitest";
import { ipfsUrl } from "./ipfs";

describe("ipfsUrl", () => {
  it("loads ipfs.io and ipfs:// links through Pinata", () => {
    const cid = "QmeUMZq9Xj8cb2JEvcTQoKvy1fqLS82iyMdXPzwhQBHMNS";
    expect(ipfsUrl(`https://ipfs.io/ipfs/${cid}`)).toBe(
      `https://gateway.pinata.cloud/ipfs/${cid}`,
    );
    expect(ipfsUrl(`ipfs://${cid}`)).toBe(
      `https://gateway.pinata.cloud/ipfs/${cid}`,
    );
  });

  it("leaves ordinary image links unchanged", () => {
    expect(ipfsUrl("/figma-home/rovo-token.png")).toBe(
      "/figma-home/rovo-token.png",
    );
    expect(ipfsUrl(null)).toBe("");
  });
});
