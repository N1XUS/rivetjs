// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Navbar } from "@rivetjs/ui/navbar";
import { ChevronDown, Hexagon } from "lucide";

export const head = { title: "Navbar: With Dropdowns" };

// #region demo
export function WithDropdowns() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Content>
          <Dropdown>
            <Button variant="ghost" size="sm" class="gap-1">
              Products
              <Icon icon={ChevronDown} size={14} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Products">
                <Dropdown.Item id="analytics" textValue="Analytics">
                  <Label>Analytics</Label>
                </Dropdown.Item>
                <Dropdown.Item id="automation" textValue="Automation">
                  <Label>Automation</Label>
                </Dropdown.Item>
                <Dropdown.Item id="reports" textValue="Reports">
                  <Label>Reports</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Navbar.Item href="#pricing">Pricing</Navbar.Item>
          <Navbar.Item href="#docs">Docs</Navbar.Item>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <WithDropdowns />
    </div>
  );
}
