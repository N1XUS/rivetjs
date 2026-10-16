// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Navbar, useNavbar } from "@rivetjs/ui/navbar";

export const head = { title: "Navbar: Programmatic Control" };

// #region demo
function MenuState() {
  const navbar = useNavbar();
  return (
    <span id="navbar-menu-state" class="text-sm text-muted">
      Menu {navbar.isMenuOpen() ? "open" : "closed"}
    </span>
  );
}

export function ProgrammaticControl() {
  const isMenuOpen = signal(false);
  return (
    <div>
      <Navbar aria-label="Main" isMenuOpen={isMenuOpen}>
        <Navbar.Header>
          <Navbar.MenuToggle />
          <span class="font-semibold">Northwind</span>
          <Navbar.Spacer />
          <MenuState />
        </Navbar.Header>
        <Navbar.Menu>
          <Navbar.MenuItem href="#profile">Profile</Navbar.MenuItem>
          <Navbar.MenuItem href="#logout">Log out</Navbar.MenuItem>
        </Navbar.Menu>
      </Navbar>
      <div class="p-6">
        <Button id="navbar-open-menu" variant="secondary" onPress={() => isMenuOpen.set(!isMenuOpen())}>
          Toggle menu from outside
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <ProgrammaticControl />
    </div>
  );
}
