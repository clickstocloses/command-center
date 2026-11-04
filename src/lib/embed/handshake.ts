const REQUEST = "REQUEST_USER_DATA";
const RESPONSE = "REQUEST_USER_DATA_RESPONSE";

/**
 * Ask the HighLevel parent window for the encrypted user payload. The payload is
 * encrypted with the shared secret, so the origin of the reply doesn't need to be
 * trusted; only the server can read it.
 */
export function requestUserData(timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (window.parent === window) {
      reject(new Error("not_in_iframe"));
      return;
    }
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("timeout"));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      const data = event.data as { message?: unknown; payload?: unknown } | null;
      if (!data || data.message !== RESPONSE) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (typeof data.payload === "string" && data.payload) resolve(data.payload);
      else reject(new Error("empty_payload"));
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ message: REQUEST }, "*");
  });
}
