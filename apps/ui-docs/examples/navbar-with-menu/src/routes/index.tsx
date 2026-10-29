// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon } from "lucide";

export const head = { title: "Navbar: With Menu" };

// #region demo
const LINKS = ["Dashboard", "Projects", "Team", "Settings"];

export function WithMenu() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.MenuToggle />
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
      </Navbar.Header>
      <Navbar.Menu>
        {LINKS.map((link, i) => (
          <Navbar.MenuItem href={`#${link.toLowerCase()}`} isCurrent={i === 0}>
            {link}
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <WithMenu />
    </div>
  );
}
