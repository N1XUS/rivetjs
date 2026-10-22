// Headers every adapter response carries (node, fetch and the platform targets, uWS): `nosniff` + a referrer policy by
// default. Web-standard (no Node APIs): fetch / edge targets import it.

/** `headers` option of an adapter: extra headers on every response; a name of a default replaces it, `null` removes it. */
export type BaseHeaders = Readonly<Record<string, string | null>>;

/**
 * The defaults merged with `headers`: names compare case-insensitively (an option replaces the default of that name,
 * never doubles it); `null` drops the name (`{ "Referrer-Policy": null }`: no referrer policy header).
 */
export function baseHeaders(headers: BaseHeaders | undefined): Record<string, string> {
  const base: Record<string, string> = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };
  for (const [name, value] of Object.entries(headers ?? {})) {
    for (const key of Object.keys(base)) if (key.toLowerCase() === name.toLowerCase()) delete base[key];
    if (value !== null) base[name] = value;
  }
  return base;
}
