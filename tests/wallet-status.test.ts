import { describe, expect, it } from "vitest";
import { walletIsSignedIn } from "../src/adapters/agenticWallet.ts";

describe("walletIsSignedIn", () => {
  it("is false when status is UNCONNECTED", () => {
    expect(walletIsSignedIn({ status: "UNCONNECTED" })).toBe(false);
  });

  it("is false when connected is missing", () => {
    expect(walletIsSignedIn({})).toBe(false);
    expect(walletIsSignedIn(undefined)).toBe(false);
  });

  it("is true only for CONNECTED or CREATING", () => {
    expect(walletIsSignedIn({ status: "CONNECTED" })).toBe(true);
    expect(walletIsSignedIn({ status: "CREATING" })).toBe(true);
    expect(walletIsSignedIn({ connected: true })).toBe(true);
    expect(walletIsSignedIn({ connected: false })).toBe(false);
  });
});
