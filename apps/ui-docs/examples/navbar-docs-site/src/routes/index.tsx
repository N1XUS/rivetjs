// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { Kbd } from "@rivetjs/ui/kbd";
import { Navbar } from "@rivetjs/ui/navbar";
import { BookOpen, Moon, Search } from "lucide";

export const head = { title: "Navbar: Docs Site" };

// #region demo
export function DocsSite() {
  return (
    <Navbar aria-label="Documentation" maxWidth="xl">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={BookOpen} size={20} />
          <span class="font-semibold">Fieldnotes</span>
          <Chip size="sm" variant="soft">
            v2.4
          </Chip>
        </Navbar.Brand>
        <Navbar.Separator />
        <Navbar.Content>
          <Navbar.Item href="#guides" isCurrent>
            Guides
          </Navbar.Item>
          <Navbar.Item href="#api">API</Navbar.Item>
          <Navbar.Item href="#examples">Examples</Navbar.Item>
          <Navbar.Item href="#changelog">Changelog</Navbar.Item>
        </Navbar.Content>
        <Navbar.Spacer />
        <Navbar.Content>
          <Button variant="secondary" size="sm" class="gap-2">
            <Icon icon={Search} size={14} />
            Search
            <Kbd>K</Kbd>
          </Button>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Toggle theme">
            <Icon icon={Moon} size={16} />
          </Button>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <DocsSite />
    </div>
  );
}
