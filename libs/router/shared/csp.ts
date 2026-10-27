// CSP options shared by the server (nonce policy) and the static adapter (hash policy).

/**
 * Extra CSP directives, merged with the generated policy. A value is a source list (string split on
 * whitespace, or an array); `true` / `[]` / `""` is a directive without sources (`upgrade-insecure-requests`).
 */
export type CSPDirectives = Readonly<Record<string, string | readonly string[] | true>>;

/** Content Security Policy options: directives, nonces and Trusted Types. */
export interface CSPOptions {
  /**
   * Enforce Trusted Types: `require-trusted-types-for 'script'` with Rivet's policies allowed — `rivet` (runtime
   * template HTML) and `rivet-script` (`@rivetjs/kit` head scripts and JSON-LD). Pass policy names to allow your own as well.
   */
  readonly trustedTypes?: boolean | readonly string[];
  /**
   * Extra directives (`{ "script-src": "'wasm-unsafe-eval'", "worker-src": ["'self'", "blob:"] }`).
   * `script-src` (and `script-src-elem`, when given) sources are added to the generated ones (nonce /
   * hashes, `'self'`); `object-src` / `base-uri` replace the generated `'none'`; other directives are
   * appended. Names are checked (unknown → `TypeError`); Trusted Types go through `trustedTypes`.
   * Nothing is added implicitly (no `'unsafe-inline'`).
   */
  readonly directives?: CSPDirectives;
}

// The directive merge + validation lives in its own module (`csp-directives.ts`): apps without
// `directives` never load it (`createApp` imports it dynamically; `strictCSP` / `hashCSP` statically).
export { cspPolicy } from "./csp-directives.ts";

/** The default strict nonce policy (+ Trusted Types): what `strictCSP` returns without `directives`. */
export const nonceCSP = (nonce: string, options?: CSPOptions): string =>
  `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'` + trustedTypesDirectives(options);

/** The Trusted Types directives for `options` (empty when off), each prefixed with `; `. */
export function trustedTypesDirectives(options: CSPOptions | undefined): string {
  const names = options?.trustedTypes;
  if (!names) return "";
  // `true`: Rivet's own policies — `rivet` (runtime template HTML) and `rivet-script` (kit head scripts / JSON-LD: URL
  // allowlist, JSON-only code); a list adds the app's.
  return `; require-trusted-types-for 'script'; trusted-types ${["rivet", "rivet-script", ...(names === true ? [] : names.filter((n) => n !== "rivet" && n !== "rivet-script"))].join(" ")}`;
}
