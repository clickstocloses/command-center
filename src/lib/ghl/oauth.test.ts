import { describe, expect, it } from "vitest";
import { GHL_SCOPES } from "./env";
import { buildInstallUrl, parseTokenResponse } from "./oauth";

describe("buildInstallUrl", () => {
  it("carries the client id, the callback and every scope", () => {
    const url = new URL(
      buildInstallUrl({ clientId: "app-123", appId: "app", redirectUri: "http://localhost:3000/api/oauth/callback" }),
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("app-123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/oauth/callback");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([...GHL_SCOPES]);
  });
});

describe("parseTokenResponse", () => {
  const good = {
    access_token: "a",
    refresh_token: "r",
    expires_in: 86399,
    scope: "locations.readonly users.readonly",
    userType: "Location",
    locationId: "loc_1",
    companyId: "co_1",
    userId: "user_1",
  };

  it("returns typed tokens for a location install", () => {
    const parsed = parseTokenResponse(good);
    expect(parsed.locationId).toBe("loc_1");
    expect(parsed.scopes).toEqual(["locations.readonly", "users.readonly"]);
    expect(parsed.expiresInSeconds).toBe(86399);
  });

  it("rejects an agency token (no locationId)", () => {
    expect(() => parseTokenResponse({ ...good, locationId: undefined })).toThrow(/location/i);
  });

  it("rejects a response without a refresh token", () => {
    expect(() => parseTokenResponse({ ...good, refresh_token: undefined })).toThrow(/refresh/i);
  });

  it("rejects garbage", () => {
    expect(() => parseTokenResponse(null)).toThrow();
    expect(() => parseTokenResponse("nope")).toThrow();
  });
});
