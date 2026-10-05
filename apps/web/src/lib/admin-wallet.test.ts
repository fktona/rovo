import { describe, expect, it } from "vitest";
import { isAdminWallet } from "./admin-wallet";

const admin = "7iMWJf5osYpuon6oDjtmZ2DvxJqRDnsZrbSBnmcuverD";

describe("isAdminWallet", () => {
  it("matches only the configured wallet address", () => {
    expect(isAdminWallet(admin, admin)).toBe(true);
    expect(isAdminWallet(` ${admin} `, admin)).toBe(true);
    expect(isAdminWallet("11111111111111111111111111111111", admin)).toBe(false);
    expect(isAdminWallet(undefined, admin)).toBe(false);
    expect(isAdminWallet(admin, "  ")).toBe(false);
    expect(isAdminWallet(admin, undefined)).toBe(false);
  });
});
