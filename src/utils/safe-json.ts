/**
 * Safe JSON & fetch — immune to SugarCube's JSON monkey-patching.
 *
 * SugarCube 2 overrides `JSON.stringify` and `JSON.parse` to handle
 * custom serialisation (Functions, Maps, Sets, RegExps, undefined,
 * Infinity, NaN). This causes `["(revive:eval)", "undefined"]` values
 * to leak into API request bodies built by the AI SDK.
 *
 * This module captures the **native** `JSON.stringify` and `JSON.parse`
 * at import time (which happens during inject_early, before SugarCube
 * boots) and exposes:
 *
 *  - `nativeStringify` / `nativeParse` — the original JSON methods
 *  - `safeFetch` — a `fetch` wrapper that re-serialises any JSON body
 *    using the native `JSON.stringify` before sending the request
 *
 * Pass `safeFetch` to the AI SDK's `fetch` option to avoid contamination.
 */

// ── Capture natives at module evaluation time ───────────────

/** The real `JSON.stringify`, captured before SugarCube patches it. */
export const nativeStringify: typeof JSON.stringify = JSON.stringify.bind(JSON);

/** The real `JSON.parse`, captured before SugarCube patches it. */
export const nativeParse: typeof JSON.parse = JSON.parse.bind(JSON);

// ── Safe fetch ──────────────────────────────────────────────

/**
 * A `fetch` wrapper that ensures the request body is serialised with
 * the **native** `JSON.stringify`.
 *
 * When the AI SDK (or any library) calls `fetch(url, init)`, the body
 * may have already been stringified by SugarCube's patched JSON.
 * We detect this case, re-parse (with native JSON.parse) and
 * re-stringify (with native JSON.stringify) to clean it up.
 *
 * If the body was passed as a plain object (some SDK versions do this)
 * we stringify it ourselves.
 */
export const safeFetch: typeof globalThis.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  if (init?.body && typeof init.body === 'string') {
    // Check if it looks like JSON (starts with { or [)
    const trimmed = init.body.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        // Re-parse with native parser, then re-stringify with native stringify.
        // This strips any SugarCube revive markers that leaked in.
        const parsed = nativeParse(init.body);
        init = { ...init, body: nativeStringify(parsed) };
      } catch {
        // Not valid JSON — leave doli-is
      }
    }
  }
  return globalThis.fetch(input, init);
};
