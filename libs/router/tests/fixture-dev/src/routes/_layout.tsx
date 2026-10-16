import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/about">About</a> <a href="/client-boom">Client boom</a> <a href="/crash">Crash</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
