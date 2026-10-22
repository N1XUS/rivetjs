import type { LayoutProps } from "@rivetjs/router";

export default function Root(props: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/docs/alpha/">Alpha</a> <a href="/docs/beta/">Beta</a> <a href="/docs/gamma/">Gamma</a>
      </nav>
      {props.children}
      <footer>Shared footer text of every page of the dictionary fixture, repeated on each document.</footer>
    </div>
  );
}
