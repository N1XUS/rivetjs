import { redirect, type LayoutProps, type RequestEvent, guard, headers } from "@rivetjs/router";
import { userFrom } from "../../session.server.ts";

// #region demo
/**
 * Runs before every page in the `(app)` folder: full page loads and client navigation alike.
 * `(app)` adds nothing to the URL: the pages are /dashboard and /settings.
 * Server code: the compiler removes it (and the session.server.ts import) from the browser build.
 */
export const access = guard(({ cookies, url, locals }: RequestEvent) => {
  const user = userFrom(cookies);
  if (!user) return redirect("/login?next=" + encodeURIComponent(url.pathname + url.search));
  // Pages' loaders read the user from `locals` instead of checking the cookie again.
  locals.user = user;
});

/** Private pages must not be stored by shared caches (CDNs, proxies). */
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store" }));
// #endregion

// The layout adds no markup of its own: it is here for the guard and the headers.
export default function AppLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
