import { signal } from "@rivetjs/reactivity";
import type { LayoutProps, RequestEvent } from "@rivetjs/router";
import { SECRET } from "../db.server.ts";
import { guard, load } from "@rivetjs/router";

export const access = guard(({ locals }: RequestEvent) => {
  locals.checked = SECRET.length > 0;
});
export const loader = load(({ locals }: RequestEvent) => ({ site: "Inline", checked: locals.checked === true }));

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  const clicks = signal(0);
  return (
    <div>
      <p id="site">{data().site} {String(data().checked)}</p>
      <nav>
        <a href="/">Home</a> <a href="/items/a">Alpha</a> <a href="/items/b">Beta</a>
      </nav>
      <button type="button" onClick={() => clicks.update((n) => n + 1)}>
        Clicks {clicks()}
      </button>
      <main>{children}</main>
    </div>
  );
}
