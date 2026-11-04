import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NORTHSIDE, OWNER_EMAIL, asAnonymous, asClient, asSecret, asStaff, seededClientId } from "./helpers";

const COMPANY = "co_fake_agency";

describe("ghl_agency_tokens table", () => {
  let northsideId: string;

  beforeAll(async () => {
    northsideId = await seededClientId(NORTHSIDE);
    const { error } = await asSecret().from("ghl_agency_tokens").insert({
      ghl_company_id: COMPANY,
      access_token_encrypted: "enc:fake-agency-access",
      refresh_token_encrypted: "enc:fake-agency-refresh",
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ["oauth.write"],
    });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await asSecret().from("ghl_agency_tokens").delete().eq("ghl_company_id", COMPANY);
    await asSecret().from("ghl_installations").delete().eq("ghl_location_id", "loc_test_minted");
  });

  it("the secret key can read agency tokens", async () => {
    const { data } = await asSecret().from("ghl_agency_tokens").select("ghl_company_id");
    expect(data).toEqual([{ ghl_company_id: COMPANY }]);
  });

  it("the owner cannot read agency tokens", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { data, error } = await owner.from("ghl_agency_tokens").select("ghl_company_id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a client session cannot read agency tokens", async () => {
    const { data } = await asClient(northsideId).from("ghl_agency_tokens").select("ghl_company_id");
    expect(data).toEqual([]);
  });

  it("anonymous cannot read agency tokens", async () => {
    const { data } = await asAnonymous().from("ghl_agency_tokens").select("ghl_company_id");
    expect(data).toEqual([]);
  });

  it("the owner cannot write agency tokens", async () => {
    const owner = await asStaff(OWNER_EMAIL);
    const { error } = await owner.from("ghl_agency_tokens").insert({
      ghl_company_id: "co_test_owner",
      access_token_encrypted: "x",
      refresh_token_encrypted: "y",
      token_expires_at: new Date().toISOString(),
    });
    expect(error?.code).toBe("42501");
  });

  it("an installation minted from the agency can have no refresh token", async () => {
    const { error } = await asSecret().from("ghl_installations").insert({
      client_id: northsideId,
      ghl_location_id: "loc_test_minted",
      ghl_company_id: COMPANY,
      access_token_encrypted: "enc:fake-minted",
      refresh_token_encrypted: null,
      token_source: "agency",
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(error).toBeNull();
  });

  it("rejects an unknown token source", async () => {
    const { error } = await asSecret().from("ghl_installations").insert({
      client_id: northsideId,
      ghl_location_id: "loc_test_bad_source",
      access_token_encrypted: "enc:x",
      token_source: "magic",
      token_expires_at: new Date().toISOString(),
    });
    expect(error?.code).toBe("23514");
  });
});
