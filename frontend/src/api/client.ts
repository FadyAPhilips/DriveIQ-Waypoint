export type ApiErrorKind = "config" | "network" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;

    // Required: without this, `error instanceof ApiError` can be false once the
    // class is transpiled and run on Hermes, which would silently downgrade
    // every real error message to a generic fallback in the UI.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function resolveBaseUrl(): string {
  // Inlined by Expo at build time, so this is a literal after bundling.
  const raw = process.env.EXPO_PUBLIC_API_URL;

  if (!raw) {
    throw new ApiError(
      "config",
      "EXPO_PUBLIC_API_URL is not set. Copy frontend/.env.example to " +
        "frontend/.env.local, add the API URL, then fully reload the app."
    );
  }

  // The deployed URL ends in a trailing slash; strip it so joining is predictable.
  return raw.replace(/\/+$/, "");
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(
      "network",
      `Could not reach ${url}. Check the device's network connection and ` +
        `that EXPO_PUBLIC_API_URL is correct.`
    );
  }

  if (!response.ok) {
    throw new ApiError(
      "http",
      `${url} returned HTTP ${response.status}.`,
      response.status
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("parse", `${url} did not return valid JSON.`);
  }
}
