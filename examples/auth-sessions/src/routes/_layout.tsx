import type { LayoutProps } from "@rivetjs/router";
import { guard, headers, load } from "@rivetjs/router";
import { Icon } from "@rivetjs/kit/icon";
import { KeyRound, LogIn, LogOut, UserPlus } from "lucide";
import { authOf, readSession } from "../server/sessions.server.ts";

// Runs first on every request below the root (pages, data requests, actions): validates the session cookie and puts
// the user on `event.locals.auth`. Pages and actions read it with `authOf(event)`.
export const authenticate = guard(readSession);

// Login and account pages must not render inside another site's frame (clickjacking).
export const security = headers(() => ({ "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'", "referrer-policy": "same-origin" }));

// The loader reads the URL (`path`, for `aria-current`), so the router reruns it on every navigation instead of keeping
// the layout's data: an enhanced sign-in redirects through a client navigation, which must show the signed-in header.
export const loader = load((event) => {
  const auth = authOf(event);
  return { user: auth ? { name: auth.user.name } : null, path: event.url.pathname };
});
const current = (path: string, href: string) => (path === href ? "page" : undefined);

const link = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-default aria-[current=page]:font-medium";

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <div class="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <header class="flex items-center gap-2 text-sm">
        <a href="/" class="me-auto inline-flex items-center gap-2 font-semibold">
          <Icon icon={KeyRound} size={18} /> Accounts
        </a>
        {data().user ? (
          <>
            <a id="nav-account" href="/account" class={link} aria-current={current(data().path, "/account")}>
              {data().user!.name}
            </a>
            {/* A plain POST form: signing out works without JavaScript and is never a GET (links can be prefetched). */}
            <form method="post" action="/account?/signout">
              <button id="signout" class={link}>
                <Icon icon={LogOut} size={16} /> Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <a id="nav-signin" href="/signin" class={link} aria-current={current(data().path, "/signin")}>
              <Icon icon={LogIn} size={16} /> Sign in
            </a>
            <a id="nav-signup" href="/signup" class={link} aria-current={current(data().path, "/signup")}>
              <Icon icon={UserPlus} size={16} /> Sign up
            </a>
          </>
        )}
      </header>
      {children}
    </div>
  );
}
