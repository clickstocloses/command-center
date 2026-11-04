import { describe, expect, it } from "vitest";
import { decryptSsoPayload } from "./sso";

// Produced by: printf '%s' '<json below>' | openssl enc -aes-256-cbc -md md5 -pass pass:test-shared-secret -base64 -A
const FIXTURE =
  "U2FsdGVkX19rkKV9eDTTMEYUBHTAqMW/YErzDTKOmZQpxskIQpPaYs8B/Ca8Fvm6bqPhM3ZEO/TJbgHctyM4+ZZaI8NiLFSmJM6Ba94Z55Mt+8RTnqO6Fn6u8dtZ51etRq+bMWyvjYcgxV7LUgWufIU9Ubye030lUCuXlBvxVSnTCMgsntAw9dRDLqSqvRr2K/TdOvf9gD1Lsexe7iY2SA2RFft2+Z3TwH1asLEyvLxte/31aLH6iNk9Dr/UE1ED";
const SECRET = "test-shared-secret";

describe("decryptSsoPayload", () => {
  it("decrypts a CryptoJS-style payload and returns the user", () => {
    const user = decryptSsoPayload(FIXTURE, SECRET);
    expect(user).toEqual({
      userId: "usr_test_1",
      companyId: "co_test_1",
      role: "admin",
      type: "location",
      activeLocation: "loc_fake_northside",
      userName: "Casey Client",
      email: "casey@example.com",
    });
  });

  it("fails with the wrong secret", () => {
    expect(() => decryptSsoPayload(FIXTURE, "nope")).toThrow(/decrypt/i);
  });

  it("rejects something that is not a Salted__ payload", () => {
    expect(() => decryptSsoPayload(Buffer.from("hello world, not encrypted at all").toString("base64"), SECRET)).toThrow(/format/i);
    expect(() => decryptSsoPayload("", SECRET)).toThrow(/format/i);
  });

  it("rejects decrypted JSON that lacks the required fields", () => {
    // Encrypted {"hello":"world"} with the same secret.
    const noFields = "U2FsdGVkX184L2f8r9XZ0pLmTak1dOaNawCeiZFEmE/+3hSk8U5NboQC/QxxRRhw";
    expect(() => decryptSsoPayload(noFields, SECRET)).toThrow(/userId/i);
  });
});
