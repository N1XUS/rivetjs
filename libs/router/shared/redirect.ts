// Open-redirect guards: `redirect()` targets and user-supplied targets (`?redirectTo=`).

/** Control characters, backslashes or a leading `//` can make browsers resolve a path to another origin. */
const UNSAFE = /[\u0000-\u001f\u007f\\]|^\s|^\/\//;
/** Absolute URL (has a scheme). */
export const ABSOLUTE = /^[a-z][a-z\d+.-]*:/i;

/** Why `location` cannot be a same-origin redirect target as written, or undefined when it can. */
export function unsafeTarget(location: string): string | undefined {
  if (UNSAFE.test(location)) return "protocol-relative, backslash or control characters";
  return undefined;
}

/** `target` when it is a same-origin path (`/a/b?c#d`), else `fallback`. Never an absolute or protocol-relative URL. */
export function safeRedirect(target: unknown, fallback = "/"): string {
  if (typeof target !== "string" || !target.startsWith("/") || unsafeTarget(target)) return fallback;
  const base = "http://rivet.invalid";
  let url: URL;
  try {
    url = new URL(target, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  // Dot segments can normalize to a leading `//` ("/.//evil.com", "/a/..//evil.com"): check the result too.
  const path = url.pathname + url.search + url.hash;
  return unsafeTarget(path) ? fallback : path;
}
