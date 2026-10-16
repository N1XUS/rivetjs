// Cookie header parsing: the one implementation behind `event.cookies` (server/handler.ts) and
// `@rivetjs/i18n` locale resolution (`requestSource`).

/**
 * Parse a `Cookie` request header (RFC 6265 §5.4 shape): `name=value` pairs split on `;`, names and
 * values trimmed, one pair of surrounding double quotes removed, values percent-decoded (a value that
 * is not valid percent-encoding is kept as written). The first occurrence of a name wins (browsers
 * send the most specific path first); pairs without `=` or with an empty name are skipped.
 */
export function parseCookies(header: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    if (!name || out.has(name)) continue;
    const raw = part
      .slice(at + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
    try {
      out.set(name, decodeURIComponent(raw));
    } catch {
      out.set(name, raw);
    }
  }
  return out;
}
