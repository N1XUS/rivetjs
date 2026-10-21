import { load, type LayoutProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// Deferred layout loader: the visitor (a cookie read), streamed into the header after the shell.
export const loader = load(
  async ({ cookies }) => {
    await gate("user");
    return { name: cookies.get("user") ?? "guest" };
  },
  { defer: true },
);

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  const visits = signal(0);
  return (
    <div id="shell">
      <header>
        <a href="/">Home</a> <a href="/other">Other</a>{" "}
        <button id="visits" type="button" onClick={() => visits.update((n) => n + 1)}>
          Visits {visits()}
        </button>
        <Async load={() => data()} fallback={() => <span id="user-wait">…</span>}>
          {(user) => <span id="user">Hello {user.name}</span>}
        </Async>
      </header>
      <main>{children}</main>
    </div>
  );
}
