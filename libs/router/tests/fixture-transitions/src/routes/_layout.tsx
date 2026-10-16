import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { Link, useNavigation } from "@rivetjs/router/client";

export default function Layout({ children }: LayoutProps) {
  const nav = useNavigation();
  const clicks = signal(0);
  return (
    <div id="shell">
      <nav>
        <Link to="/">Home</Link> <Link to="/items/1" transition="zoom" pending="is-pending">First</Link>{" "}
        <Link to="/items/2?slow=600">Slow</Link> <a href="/items/1" data-transition="none">Instant</a>{" "}
        <Link to="/plain" prefetch="none">Plain</Link> <a href="/guarded">Guarded</a>
      </nav>
      <p id="nav-state">{nav().state + (nav().shown ? " shown" : "")}</p>
      <button type="button" id="layout-clicks" onClick={() => clicks.update((n) => n + 1)}>
        Layout clicks {clicks()}
      </button>
      <main>{children}</main>
    </div>
  );
}
