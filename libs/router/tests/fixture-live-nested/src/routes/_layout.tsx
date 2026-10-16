import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ data, children }: LayoutProps<{ loads: number }>) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/shop?q=a">Shop a</a> <a href="/shop?q=b">Shop b</a>
      </nav>
      <p id="root-loads">{data().loads}</p>
      <main>{children}</main>
    </div>
  );
}
