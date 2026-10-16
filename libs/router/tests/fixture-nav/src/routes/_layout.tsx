import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/bare">Bare</a> <a href="/empty">Empty</a> <a href="/long">Long</a>{" "}
        <a href="/long?again=1">Long again</a> <a href="/long#far">Long far</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
