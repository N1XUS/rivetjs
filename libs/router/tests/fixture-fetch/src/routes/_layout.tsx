import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/counter">Counter</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
