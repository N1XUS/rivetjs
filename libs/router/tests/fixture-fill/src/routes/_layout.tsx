import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell" style={{ display: "flex", "flex-direction": "column", height: "400px" }}>
      <nav style={{ height: "40px" }}>
        <a href="/">Home</a> <a href="/full">Full</a> <a href="/deep/page">Deep</a> <a href="/x/any">Any</a> <a href="/x/plain">Plain</a>
      </nav>
      <main style={{ flex: "1", "min-height": "0", display: "flex", "flex-direction": "column" }}>{children}</main>
    </div>
  );
}
