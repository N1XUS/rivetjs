import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

// Module-level component used in render (resume compilation exports such bindings).
const Note = () => <small id="layout-note">fixture</small>;

export default function Layout({ data, children }: LayoutProps<{ site: string; path: string }>) {
  const clicks = signal(0);
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/items/1">First</a> <a href="/items/2">Second</a> <a href="/private">Private</a>{" "}
        <a href="/long">Long</a> <a href="/missing">Missing</a> <a href="/broken">Broken</a>
      </nav>
      <p id="site">{data().site}</p>
      <p id="layout-path">{data().path}</p>
      <button type="button" id="layout-clicks" onClick={() => clicks.update((n) => n + 1)}>
        Layout clicks {clicks()}
      </button>
      <Note />
      <main>{children}</main>
    </div>
  );
}
