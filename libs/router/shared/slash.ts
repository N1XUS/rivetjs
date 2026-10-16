// Trailing-slash policy (`rivetRouter({ trailingSlash })`). `"ignore"` (default): `/a` and `/a/` are
// the same page, URLs stay as written. `"never"` / `"always"`: one canonical form; page GET/HEAD
// requests for the other answer 308 (server/handler.ts), `<Link>` / `navigate()` hrefs are written in
// it and the static adapter lays files out for it. `TRAILING_SLASH` is a build-time constant: the
// router's Vite plugin rewrites it in this module only when the option is set, so apps without it
// fold the canonicalization away (and their bundles stay byte-identical).

/** Trailing slash policy: keep URLs as written, strip the slash, or add it. */
export type TrailingSlash = "ignore" | "never" | "always";

/** The app's policy (rewritten by `build/vite.ts` when `rivetRouter({ trailingSlash })` is set). */
export const TRAILING_SLASH = "ignore" as TrailingSlash;

/** A last path segment with a file extension (`/sitemap.xml`, `/a/b.json`; not a dot-file like `/.well-known`). */
const FILE = /[^/]\.[^./]+$/;

/** A URL path in canonical form; `/` (and `ignore`) unchanged. `always` leaves file paths (`/sitemap.xml`) unslashed. */
export function slashPath(pathname: string, policy: TrailingSlash): string {
  if (policy === "ignore" || pathname === "/") return pathname;
  const has = pathname.endsWith("/");
  return policy === "never" ? (has ? pathname.slice(0, -1) : pathname) : has || FILE.test(pathname) ? pathname : pathname + "/";
}

/** A path href (`/a?q#h`) with its path in canonical form; other forms (full, relative URLs) unchanged. */
export function slashHref(href: string, policy: TrailingSlash = TRAILING_SLASH): string {
  if (policy === "ignore" || !href.startsWith("/") || href.startsWith("//")) return href;
  const at = href.search(/[?#]/);
  return at < 0 ? slashPath(href, policy) : slashPath(href.slice(0, at), policy) + href.slice(at);
}
