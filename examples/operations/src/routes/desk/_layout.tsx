import { guard, headers, load, deny, type RequestEvent, type LayoutProps } from "@rivetjs/router";
import { sessionUser } from "../../server/service.server.ts";
import { SiteNav } from "../../sites/SiteNav.tsx";
export const access = guard((e: RequestEvent) => {
  const user = sessionUser(e.cookies.get("case-session"));
  if (!user) throw deny(401, "Sign in required");
  e.locals.user = user;
});
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store", vary: "Cookie" }));
export const loader = load((e: RequestEvent) => ({ user: sessionUser(e.cookies.get("case-session"))! }));
export default function DeskLayout(props: LayoutProps<typeof loader>) {
  return (
    <>
      <SiteNav />
      <div class="desk-frame">
        <aside class="desk-sidebar">
          <p class="eyebrow">CASEWORK</p>
          <strong>{props.data().user.tenant.toUpperCase()} WORKSPACE</strong>
          <a href="/desk">Inbox</a>
          <a href="/desk/editor">Publishing</a>
          <a href="/desk/admin">Administration</a>
          <hr />
          <p id="desk-identity">
            {props.data().user.name}
            <br />
            {props.data().user.role}
          </p>
          <form method="post" action="/auth/logout">
            <button id="logout">Sign out</button>
          </form>
        </aside>
        <div class="desk-content">{props.children}</div>
      </div>
    </>
  );
}
