import { redirect, type LayoutProps, type RequestEvent, guard } from "@rivetjs/router";
import { userFor } from "../../sessions.server.ts";

// #region demo
// Runs before every page in the (private) folder, for full page loads and client navigation.
// The compiler removes it (and the sessions import) from the browser build.
export const access = guard(({ cookies, url, locals }: RequestEvent) => {
  const user = userFor(cookies.get("session"));
  if (!user) return redirect("/login?next=" + encodeURIComponent(url.pathname));
  // Pages and loaders further down the chain can read it.
  locals.user = user;
});
// #endregion

// The layout adds no markup of its own: it is here for the guard.
export default function PrivateLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
