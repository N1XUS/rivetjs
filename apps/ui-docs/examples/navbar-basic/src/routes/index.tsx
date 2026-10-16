// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon } from "lucide";

export const head = { title: "Navbar: Usage" };

// #region demo
export function Basic() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Content>
          <Navbar.Item href="#features">Features</Navbar.Item>
          <Navbar.Item href="#pricing" isCurrent>
            Pricing
          </Navbar.Item>
          <Navbar.Item href="#customers">Customers</Navbar.Item>
        </Navbar.Content>
        <Navbar.Spacer />
        <Navbar.Content>
          <Navbar.Item href="#login">Log in</Navbar.Item>
          <Button size="sm">Sign up</Button>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <Basic />
    </div>
  );
}
