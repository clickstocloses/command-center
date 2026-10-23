import { GHL_API_BASE, GHL_API_VERSION } from "./env";
import { getLocationAccessToken } from "./installations";

export class GhlApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`HighLevel API ${status} on ${path}: ${body.slice(0, 300)}`);
  }
}

/**
 * The one way to call the HighLevel API for a location. Adds auth and the
 * Version header, refreshes the token once on a 401, and throws a typed error.
 */
export async function ghlFetch<T>(locationId: string, path: string, init: RequestInit = {}): Promise<T> {
  const attempt = async (accessToken: string) =>
    fetch(`${GHL_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Version: GHL_API_VERSION,
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await attempt(await getLocationAccessToken(locationId));
  if (response.status === 401) {
    response = await attempt(await getLocationAccessToken(locationId, { force: true }));
  }

  if (!response.ok) {
    throw new GhlApiError(response.status, path, await response.text().catch(() => ""));
  }
  return (await response.json()) as T;
}

/** Same call, but with a token we already hold (used right after install, before anything is stored). */
export async function ghlFetchWithToken<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Version: GHL_API_VERSION,
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new GhlApiError(response.status, path, await response.text().catch(() => ""));
  }
  return (await response.json()) as T;
}
