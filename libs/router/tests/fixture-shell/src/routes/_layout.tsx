import { guard, load, type LayoutProps, type RequestEvent } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { gate, runs } from "../gate.server.ts";

// Signed-in visitors: the guard puts the session on `locals` (guards run on every request, shell hits included).
export const access = guard(({ cookies, locals }: RequestEvent) => {
  const user = cookies.get("user");
  if (user) locals.user = user;
});

// The hole: a deferred loader reading the visitor's cookie, streamed into the header after the shell.
export const loader = load(
  async ({ cookies }) => {
    await gate("user");
    const name = cookies.get("user") ?? "guest";
    runs["as:" + name] = (runs["as:" + name] ?? 0) + 1;
    return { name };
  },
  { defer: true },
);

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  const visits = signal(0);
  return (
    <div id="shell">
      <header>
        <a href="/article">Article</a>{" "}
        <button id="visits" type="button" onClick={() => visits.update((n) => n + 1)}>
          Visits {visits()}
        </button>
        <Async load={() => data()} fallback={() => <span id="user-wait">…</span>}>
          {(user) => {
            const opened = signal(false);
            return (
              <span id="user">
                Hello {user.name}{" "}
                <button id="menu" type="button" onClick={() => opened.update((v) => !v)}>
                  {opened() ? "Close" : "Menu"}
                </button>
              </span>
            );
          }}
        </Async>
      </header>
      <main>{children}</main>
    </div>
  );
}
