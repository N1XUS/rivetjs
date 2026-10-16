// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { RouterProvider } from "@rivetjs/cdk/link";
import { signal } from "@rivetjs/reactivity";
import { Navbar } from "@rivetjs/ui/navbar";

export const head = { title: "Navbar: Global RouterProvider" };

// #region demo
export function RoutingProvider() {
  // Stand-in for a router's location; with @rivetjs/router the app's router provides navigation.
  const path = signal("/inbox");
  return (
    <RouterProvider navigate={(href: string) => path.set(href)}>
      <Navbar aria-label="Main">
        <Navbar.Header>
          <Navbar.Content>
            <Navbar.Item href="/inbox" isCurrent={() => path() === "/inbox"}>
              Inbox
            </Navbar.Item>
            <Navbar.Item href="/drafts" isCurrent={() => path() === "/drafts"}>
              Drafts
            </Navbar.Item>
            <Navbar.Item href="/sent" isCurrent={() => path() === "/sent"}>
              Sent
            </Navbar.Item>
          </Navbar.Content>
        </Navbar.Header>
      </Navbar>
      <p class="p-6 text-sm text-muted">
        Location: <span id="navbar-route-path">{path()}</span>
      </p>
    </RouterProvider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <RoutingProvider />
    </div>
  );
}
