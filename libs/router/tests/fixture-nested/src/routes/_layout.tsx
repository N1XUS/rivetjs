import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ data, children }: LayoutProps<{ loads: number }>) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/about">About</a> <a href="/shop/a">Shop A</a> <a href="/shop/b">Shop B</a> <a href="/shop/b?q=1">Shop B q</a> <a href="/shop/broken">Broken</a>{" "}
        <a href="/u/1/x">U1 X</a> <a href="/u/1/y">U1 Y</a> <a href="/u/2/x">U2 X</a>
      </nav>
      <p id="root-loads">{data().loads}</p>
      <main>{children}</main>
    </div>
  );
}
