import type { LayoutProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <Link to="/">Home</Link> <Link to="/about">About</Link> <Link to="/items/1">Item 1</Link>{" "}
        <a href="/elsewhere" id="outside">
          Outside
        </a>{" "}
        <Link to="/" active="prefix" id="section" data-kind="nav" title="Section">
          Section
        </Link>{" "}
        <Link to="/items/2" active id="item-2">
          Item 2
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
