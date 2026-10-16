import type { LayoutProps } from "@rivetjs/router";

export default function Root(props: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/">Home</a> <a href="/careers/">Careers</a> <a href="/contact/">Contact</a> <a href="/privacy/">Privacy</a>
      </nav>
      {props.children}
    </div>
  );
}
