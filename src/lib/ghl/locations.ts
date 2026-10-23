import { ghlFetch, ghlFetchWithToken } from "./client";
import type { LocationProfile } from "./installations";

type LocationResponse = {
  location?: Record<string, unknown>;
} & Record<string, unknown>;

function toProfile(raw: LocationResponse): LocationProfile {
  // HighLevel wraps the record in { location: {...} }. Be tolerant if that ever changes.
  const location = (raw.location ?? raw) as Record<string, unknown>;
  const text = (key: string) => (typeof location[key] === "string" && location[key] ? (location[key] as string) : null);
  return {
    name: text("name"),
    timezone: text("timezone"),
    website: text("website"),
    companyId: text("companyId"),
  };
}

export async function fetchLocationWithToken(accessToken: string, locationId: string): Promise<LocationProfile> {
  return toProfile(await ghlFetchWithToken<LocationResponse>(accessToken, `/locations/${locationId}`));
}

export async function fetchLocation(locationId: string): Promise<LocationProfile> {
  return toProfile(await ghlFetch<LocationResponse>(locationId, `/locations/${locationId}`));
}
