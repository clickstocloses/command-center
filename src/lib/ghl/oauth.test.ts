import { describe, expect, it } from "vitest";
import { GHL_SCOPES } from "./env";
import {
  buildInstallUrl,
  newOauthState,
  parseInstalledLocations,
  parseLocationTokenResponse,
  parseTokenResponse,
  verifyOauthState,
} from "./oauth";

describe("oauth state", () => {
  it("is included in the install URL when given", () => {
    const url = new URL(buildInstallUrl({ clientId: "c", appId: "a", redirectUri: "http://x/cb", state: "abc" }));
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("is random and long", () => {
    expect(newOauthState()).not.toBe(newOauthState());
    expect(newOauthState().length).toBeGreaterThanOrEqual(40);
  });

  it("accepts a matching state and cookie", () => {
    expect(verifyOauthState("s1", "s1")).toBe("ok");
  });

  it("allows a marketplace-started install with neither", () => {
    expect(verifyOauthState(null, null)).toBe("marketplace");
  });

  it("rejects a mismatch, a missing cookie, or a missing param", () => {
    expect(verifyOauthState("s1", "s2")).toBe("mismatch");
    expect(verifyOauthState("s1", null)).toBe("mismatch");
    expect(verifyOauthState(null, "s1")).toBe("mismatch");
  });
});

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
    if (parsed.kind !== "location") throw new Error("expected a location token");
    expect(parsed.locationId).toBe("loc_1");
    expect(parsed.scopes).toEqual(["locations.readonly", "users.readonly"]);
    expect(parsed.expiresInSeconds).toBe(86399);
  });

  it("returns an agency token with its approved locations", () => {
    const parsed = parseTokenResponse({
      ...good,
      userType: "Company",
      locationId: undefined,
      approvedLocations: ["loc_1", "loc_2"],
    });
    if (parsed.kind !== "agency") throw new Error("expected an agency token");
    expect(parsed.companyId).toBe("co_1");
    expect(parsed.approvedLocations).toEqual(["loc_1", "loc_2"]);
    expect(parsed.refreshToken).toBe("r");
  });

  it("treats an agency token with no approved locations as an empty list", () => {
    const parsed = parseTokenResponse({ ...good, userType: "Company", locationId: undefined });
    if (parsed.kind !== "agency") throw new Error("expected an agency token");
    expect(parsed.approvedLocations).toEqual([]);
  });

  it("rejects an agency token without a company id", () => {
    expect(() => parseTokenResponse({ ...good, locationId: undefined, companyId: undefined })).toThrow(/company/i);
  });

  it("rejects a response without a refresh token", () => {
    expect(() => parseTokenResponse({ ...good, refresh_token: undefined })).toThrow(/refresh/i);
  });

  it("rejects garbage", () => {
    expect(() => parseTokenResponse(null)).toThrow();
    expect(() => parseTokenResponse("nope")).toThrow();
  });
});

describe("parseLocationTokenResponse (minted from the agency token)", () => {
  it("returns a location token with no refresh token", () => {
    const parsed = parseLocationTokenResponse(
      { access_token: "la", expires_in: 86399, scope: "locations.readonly", locationId: "loc_1", userId: "user_1" },
      "co_1",
    );
    expect(parsed.kind).toBe("location");
    expect(parsed.locationId).toBe("loc_1");
    expect(parsed.companyId).toBe("co_1");
    expect(parsed.refreshToken).toBeNull();
    expect(parsed.scopes).toEqual(["locations.readonly"]);
  });

  it("rejects a response without a location id or access token", () => {
    expect(() => parseLocationTokenResponse({ access_token: "la", expires_in: 1 }, "co_1")).toThrow(/location/i);
    expect(() => parseLocationTokenResponse({ expires_in: 1, locationId: "loc_1" }, "co_1")).toThrow(/access_token/i);
  });
});

describe("parseInstalledLocations", () => {
  it("keeps only locations where the app is installed", () => {
    const parsed = parseInstalledLocations({
      locations: [
        { _id: "loc_1", name: "Northside", isInstalled: true },
        { _id: "loc_2", name: "Brightline", isInstalled: false },
        { _id: "loc_3", isInstalled: true },
        { name: "no id", isInstalled: true },
      ],
      count: 4,
    });
    expect(parsed).toEqual([
      { id: "loc_1", name: "Northside" },
      { id: "loc_3", name: null },
    ]);
  });

  it("rejects a response without a locations array", () => {
    expect(() => parseInstalledLocations({ count: 0 })).toThrow(/locations/i);
    expect(() => parseInstalledLocations(null)).toThrow();
  });
});
