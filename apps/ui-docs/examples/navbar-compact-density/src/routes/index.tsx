// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon, Play, Share2 } from "lucide";

export const head = { title: "Navbar: Compact Density" };

// #region demo
export function CompactDensity() {
  return (
    <Navbar aria-label="Editor" size="sm" height="2.75rem" maxWidth="full">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Separator />
        <Navbar.Content>
          <Navbar.Item href="#file">File</Navbar.Item>
          <Navbar.Item href="#edit">Edit</Navbar.Item>
          <Navbar.Item href="#view">View</Navbar.Item>
        </Navbar.Content>
        <Navbar.Spacer />
        <Navbar.Content>
          <Button size="sm" variant="ghost" isIconOnly aria-label="Share">
            <Icon icon={Share2} size={14} />
          </Button>
          <Button size="sm" class="gap-1">
            <Icon icon={Play} size={14} />
            Run
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
      <CompactDensity />
    </div>
  );
}
