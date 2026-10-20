import type { LayoutProps } from "@rivetjs/router";

// Every link kind the client router must route or leave to the browser (`tests/document-links.test.ts`).
export default function Layout({ children }: LayoutProps) {
  return (
    <div id="shell">
      <nav>
        <a href="/" id="home">
          Home
        </a>
        <a href="/items/1" id="item">
          Item 1
        </a>
        <a href="/items/3/" id="slash">
          Item 3 (trailing slash)
        </a>
        <a href="/items/2" data-rivet-reload="" id="reload">
          Item 2 (reload)
        </a>
        <a href="/items/export" id="export">
          Export (endpoint a page pattern also fits)
        </a>
        <a href="/api/ping" id="ping">
          Ping (endpoint)
        </a>
        <a href="/legacy.html" id="legacy">
          Legacy (static file)
        </a>
        <a href="/nope" id="nope">
          Unknown
        </a>
        <a href="/report" id="report">
          Report (document route: *.server.ts)
        </a>
        <a href="/secret" id="secret">
          Secret (document route: declared server-only module)
        </a>
        <a href="/broken" id="broken">
          Broken (throws when the browser renders it)
        </a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
