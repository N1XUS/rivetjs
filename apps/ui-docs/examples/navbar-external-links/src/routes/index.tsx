// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Navbar } from "@rivetjs/ui/navbar";
import { ArrowUpRight } from "lucide";

export const head = { title: "Navbar: External Links and Force Reload" };

// #region demo
export function ExternalLinks() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.Content>
          <Navbar.Item href="#home" isCurrent>
            Home
          </Navbar.Item>
          <Navbar.Item href="https://example.com/status" class="gap-1">
            Status
            <Icon icon={ArrowUpRight} size={14} />
          </Navbar.Item>
          <Navbar.Item href="/legacy-admin" forceReload>
            Legacy admin
          </Navbar.Item>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <ExternalLinks />
    </div>
  );
}
