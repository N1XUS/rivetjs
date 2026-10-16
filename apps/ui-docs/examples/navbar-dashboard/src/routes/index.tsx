// Rivet-authored Navbar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Navbar } from "@rivetjs/ui/navbar";
import { Bell, Hexagon, Settings } from "lucide";

export const head = { title: "Navbar: Dashboard" };

// #region demo
export function Dashboard() {
  return (
    <Navbar aria-label="App" maxWidth="full">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Separator />
        <Navbar.Content>
          <Navbar.Item href="#overview" isCurrent>
            Overview
          </Navbar.Item>
          <Navbar.Item href="#projects">Projects</Navbar.Item>
          <Navbar.Item href="#billing">Billing</Navbar.Item>
        </Navbar.Content>
        <Navbar.Spacer />
        <Navbar.Content>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Notifications">
            <Icon icon={Bell} size={16} />
          </Button>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Settings">
            <Icon icon={Settings} size={16} />
          </Button>
          <Avatar size="sm">
            <Avatar.Fallback>MQ</Avatar.Fallback>
          </Avatar>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <Dashboard />
    </div>
  );
}
