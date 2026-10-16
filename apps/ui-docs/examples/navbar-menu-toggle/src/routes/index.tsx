// Rivet example (no HeroUI counterpart): the default morph burger (TWEAKS.md TW-149), its style hooks and custom icons.
import { Icon } from "@rivetjs/kit/icon";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon, Menu, X } from "lucide";

export const head = { title: "Navbar: Menu Toggle" };

// #region demo
const LINKS = ["Dashboard", "Projects", "Team"];

export function MenuToggle() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        {/* Default: morph burger (Menu → X). */}
        <Navbar.MenuToggle />
        {/* Style hooks: size, stroke, duration (0s = instant swap). */}
        <Navbar.MenuToggle class="[--navbar-toggle-size:24px] [--navbar-toggle-stroke:2.5px] [--navbar-toggle-duration:480ms]" />
        {/* Own icons: children replace the morph; swap them on the toggle's aria-expanded. */}
        <Navbar.MenuToggle class="group">
          <Icon icon={Menu} size={20} class="group-aria-expanded:hidden" />
          <Icon icon={X} size={20} class="hidden group-aria-expanded:block" />
        </Navbar.MenuToggle>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
      </Navbar.Header>
      <Navbar.Menu>
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
      <MenuToggle />
    </div>
  );
}
