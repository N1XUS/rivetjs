// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon } from "lucide";

export const head = { title: "Navbar: Responsive Mobile Menu" };

// #region demo
const LINKS = ["Features", "Pricing", "Customers", "Blog"];

export function ResponsiveMobileMenu() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.MenuToggle class="md:hidden" />
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Content class="hidden md:flex">
          {LINKS.map((link) => (
            <Navbar.Item href={`#${link.toLowerCase()}`}>{link}</Navbar.Item>
          ))}
        </Navbar.Content>
        <Navbar.Spacer />
        <Button size="sm">Get started</Button>
      </Navbar.Header>
      <Navbar.Menu class="md:hidden">
        {LINKS.map((link) => (
          <Navbar.MenuItem href={`#${link.toLowerCase()}`}>{link}</Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <ResponsiveMobileMenu />
    </div>
  );
}
