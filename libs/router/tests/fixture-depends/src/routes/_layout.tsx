import type { LayoutProps } from "@rivetjs/router";
import { invalidate } from "@rivetjs/router/client";

// Root layout (depends "session"): buttons for every invalidate() form the test drives.
export default function Layout({ data, children }: LayoutProps<{ loads: number }>) {
  return (
    <div id="shell">
      <nav>
        <a href="/shop/a">Shop A</a> <a href="/shop/b">Shop B</a> <a href="/plain">Plain</a>
      </nav>
      <p id="root-loads">{data().loads}</p>
      <button type="button" id="inv-cart" onClick={() => invalidate("cart").then(() => (document.documentElement.dataset.done = "cart"))}>cart</button>
      <button type="button" id="inv-session" onClick={() => invalidate("session").then(() => (document.documentElement.dataset.done = "session"))}>session</button>
      <button type="button" id="inv-both" onClick={() => invalidate(["cart", "session"]).then(() => (document.documentElement.dataset.done = "both"))}>both</button>
      <button type="button" id="inv-api" onClick={() => invalidate((key) => key.startsWith("/api/")).then(() => (document.documentElement.dataset.done = "api"))}>api</button>
      <button type="button" id="inv-none" onClick={() => invalidate("nothing").then(() => (document.documentElement.dataset.done = "none"))}>none</button>
      <button type="button" id="inv-all" onClick={() => invalidate().then(() => (document.documentElement.dataset.done = "all"))}>all</button>
      <main>{children}</main>
    </div>
  );
}
