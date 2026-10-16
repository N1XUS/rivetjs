// `strictCSP` with `directives`: own module so `createApp` loads the directive merge only when an app passes
// directives (dynamic import); the default policy is `nonceCSP` (shared/csp.ts).
import { nonceCSP, type CSPOptions } from "../shared/csp.ts";
import { cspPolicy } from "../shared/csp-directives.ts";

/**
 * Strict CSP: only nonce'd scripts and what they load run; no plugins, no `<base>` hijacking.
 * `{ trustedTypes: true }` also enforces Trusted Types (`csp: (nonce) => strictCSP(nonce, { trustedTypes: true })`);
 * `{ directives }` merges extra directives (`cspPolicy`).
 */
export const strictCSP = (nonce: string, options?: CSPOptions): string =>
  options?.directives
    ? cspPolicy(
        [
          ["script-src", [`'nonce-${nonce}'`, "'strict-dynamic'"]],
          ["object-src", ["'none'"]],
          ["base-uri", ["'none'"]],
        ],
        options,
        false,
        // Inline `<style>`s (inlined stylesheets, head styles) carry the nonce: allowed by a `style-src` the app sets.
        [`'nonce-${nonce}'`],
      )
    : nonceCSP(nonce, options);
