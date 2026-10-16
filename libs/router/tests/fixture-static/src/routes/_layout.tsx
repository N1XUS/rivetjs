import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  const clicks = signal(0);
  return (
    <div>
      <nav>
        <a href="/">Home</a> <a href="/about">About</a>
      </nav>
      <button type="button" onClick={() => clicks.update((n) => n + 1)}>
        Clicks {clicks()}
      </button>
      <main>{children}</main>
    </div>
  );
}
