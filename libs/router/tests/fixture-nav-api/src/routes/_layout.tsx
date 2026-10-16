import type { LayoutProps } from "@rivetjs/router";
import { useParams, useSearchParams } from "@rivetjs/router/client";

// Root layout: stays mounted; its search params follow every commit (also when resumed).
export default function Layout({ children }: LayoutProps) {
  const search = useSearchParams();
  const params = useParams();
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/counter">Counter</a> <a href="/about">About</a>
      </nav>
      <p id="root-q">{search().get("q") ?? "-"}</p>
      <p id="root-params">{JSON.stringify(params())}</p>
      <main>{children}</main>
    </div>
  );
}
