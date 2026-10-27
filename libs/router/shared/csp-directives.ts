// CSP directive merge + validation (`directives` option): loaded only by apps that pass directives
// (`createApp` dynamic import, `strictCSP` / static `hashCSP`), so the default policy carries none of it.
import { trustedTypesDirectives, type CSPOptions } from "./csp.ts";

/** CSP Level 3 directive names (+ Trusted Types, `upgrade-insecure-requests`, reporting). */
const DIRECTIVES = new Set([
  "default-src",
  "script-src",
  "script-src-elem",
  "script-src-attr",
  "style-src",
  "style-src-elem",
  "style-src-attr",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "child-src",
  "frame-src",
  "worker-src",
  "manifest-src",
  "fenced-frame-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "sandbox",
  "upgrade-insecure-requests",
  "report-uri",
  "report-to",
  "webrtc",
]);
/** Ignored by browsers in a `<meta>` policy (CSP3 §3.3): header only. */
const HEADER_ONLY = new Set(["frame-ancestors", "report-uri", "report-to", "sandbox"]);
// One source expression: no whitespace, no directive / policy separators, nothing that breaks out of an attribute.
const SOURCE = /^[^\s;,"'<>\\]+$|^'[A-Za-z0-9+/=_-]+'$/;

/**
 * The policy string for `generated` (directive → sources, in order) merged with `options.directives`
 * and the Trusted Types directives. `meta`: the policy goes into a `<meta>` (header-only directives throw).
 * `styles`: the sources of the page's own `<style>` elements (nonce / hashes: inlined stylesheets, head styles), added
 * to a `style-src` / `style-src-elem` the options set; with neither but a `default-src` (which then governs styles), to a
 * synthesized `style-src` = the `default-src` sources (none of the three: inline styles are not restricted). A list with
 * `'unsafe-inline'` is left as given (a nonce or hash would turn it off).
 */
export function cspPolicy(
  generated: readonly (readonly [string, readonly string[]])[],
  options: CSPOptions | undefined,
  meta = false,
  styles: readonly string[] = [],
): string {
  const policy = new Map<string, string[]>(generated.map(([name, sources]) => [name, [...sources]]));
  const extra = options?.directives;
  if (extra) {
    for (const [raw, value] of Object.entries(extra)) {
      const name = raw.toLowerCase();
      if (name === "require-trusted-types-for" || name === "trusted-types") throw new TypeError(`CSP directive "${raw}": use the trustedTypes option`);
      if (!DIRECTIVES.has(name)) throw new TypeError(`Unknown CSP directive "${raw}"`);
      if (meta && HEADER_ONLY.has(name)) throw new TypeError(`CSP directive "${name}" is ignored in a <meta> policy: send it as a header from your host`);
      const sources = value === true ? [] : typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [...value];
      for (const source of sources)
        if (typeof source !== "string" || !SOURCE.test(source)) throw new TypeError(`Invalid CSP source ${JSON.stringify(source)} in "${name}"`);
      if (name === "script-src" || name === "script-src-elem") {
        // Additive: the generated sources (nonce / hashes) are what lets the page's own scripts run.
        const list = policy.get(name) ?? (name === "script-src-elem" ? [...(policy.get("script-src") ?? [])] : []);
        for (const source of sources) if (!list.includes(source)) list.push(source);
        policy.set(name, list);
      } else {
        policy.delete(name);
        policy.set(name, sources);
      }
    }
  }
  if (styles.length) {
    // `default-src` alone governs styles too: the page's own `<style>`s get a `style-src` of its sources + theirs.
    const fallback = policy.get("default-src");
    if (fallback && !policy.has("style-src") && !policy.has("style-src-elem") && !fallback.includes("'unsafe-inline'"))
      policy.set(
        "style-src",
        fallback.filter((source) => source !== "'none'"),
      );
    for (const name of ["style-src", "style-src-elem"]) {
      const list = policy.get(name);
      if (list && !list.includes("'unsafe-inline'")) for (const source of styles) if (!list.includes(source)) list.push(source);
    }
  }
  let out = "";
  for (const [name, sources] of policy) out += (out ? "; " : "") + (sources.length ? `${name} ${sources.join(" ")}` : name);
  return out + trustedTypesDirectives(options);
}
