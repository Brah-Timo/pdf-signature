/**
 * pdf-signature — SDK Configuration Manager
 * Reads API key and settings from environment variables or explicit config.
 */

import type { SdkConfig } from "./types.js";
import { AuthenticationError } from "./types.js";

const DEFAULT_API_BASE_URL = "https://api.pdf-signature.dev";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_ATTEMPTS = 3;

let _config: SdkConfig | null = null;

/**
 * Configure the SDK explicitly (alternative to environment variables).
 * Call this once at application startup.
 *
 * @example
 * import { configure } from 'pdf-signature';
 * configure({ apiKey: process.env.PDF_SIGN_API_KEY! });
 */
export function configure(options: {
  apiKey: string;
  apiBaseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  debug?: boolean;
}): void {
  _config = {
    apiKey: options.apiKey,
    apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    retryAttempts: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
    debug: options.debug ?? false,
  };
}

/**
 * Retrieve the current SDK configuration.
 * Falls back to environment variables if configure() was not called.
 * @internal
 */
export function getConfig(): SdkConfig {
  if (_config) return _config;

  const apiKey =
    process.env["PDF_SIGN_API_KEY"] ??
    process.env["PDF_SIGNATURE_API_KEY"] ??
    "";

  if (!apiKey) {
    throw new AuthenticationError(
      "No API key found. Set PDF_SIGN_API_KEY environment variable or call configure({ apiKey: '...' }). " +
      "Get your free key at: https://pdf-signature.dev"
    );
  }

  return {
    apiKey,
    apiBaseUrl:
      process.env["PDF_SIGN_API_URL"] ?? DEFAULT_API_BASE_URL,
    timeout: Number(process.env["PDF_SIGN_TIMEOUT"] ?? DEFAULT_TIMEOUT_MS),
    retryAttempts: Number(
      process.env["PDF_SIGN_RETRY_ATTEMPTS"] ?? DEFAULT_RETRY_ATTEMPTS
    ),
    debug: process.env["PDF_SIGN_DEBUG"] === "true",
  };
}

/** Reset config (useful in tests) */
export function _resetConfig(): void {
  _config = null;
}
