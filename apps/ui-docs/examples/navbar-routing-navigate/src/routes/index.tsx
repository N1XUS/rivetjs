// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Navbar } from "@rivetjs/ui/navbar";

export const head = { title: "Navbar: navigate Callback" };

// #region demo
export function RoutingNavigate() {
  const path = signal("/inbox");
  return (
    <div>
      <Navbar aria-label="Main" navigate={(href) => path.set(href)}>
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <RoutingNavigate />
    </div>
  );
}
