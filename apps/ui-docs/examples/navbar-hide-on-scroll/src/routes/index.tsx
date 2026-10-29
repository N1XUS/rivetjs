// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon } from "lucide";

export const head = { title: "Navbar: Hide on Scroll" };

// #region demo
export function HideOnScroll() {
  return (
    <div>
      <Navbar aria-label="Main" hideOnScroll>
        <Navbar.Header>
          <Navbar.Brand>
            <Icon icon={Hexagon} size={22} />
            <span class="font-semibold">Northwind</span>
          </Navbar.Brand>
          <Navbar.Content>
            <Navbar.Item href="#stories" isCurrent>
              Stories
            </Navbar.Item>
            <Navbar.Item href="#about">About</Navbar.Item>
          </Navbar.Content>
        </Navbar.Header>
      </Navbar>
      <main class="mx-auto max-w-prose space-y-4 p-6">
        {Array.from({ length: 24 }, (_, i) => (
          <p class="text-sm text-muted">Paragraph {i + 1}: scroll down to hide the bar, scroll up to bring it back.</p>
        ))}
      </main>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <HideOnScroll />
    </div>
  );
}
