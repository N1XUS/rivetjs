// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/navigation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bell, House, Mail, Menu, Search, Settings, User } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Navigation Drawer" };

// #region demo
export function Navigation() {
  const navItems = [
    { icon: House, label: "Home" },
    { icon: Search, label: "Search" },
    { icon: Bell, label: "Notifications" },
    { icon: Mail, label: "Messages" },
    { icon: User, label: "Profile" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <Drawer placement="left">
      <Button variant="secondary">
        <Icon icon={Menu} />
        Menu
      </Button>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Heading>Navigation</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <nav class="flex flex-col gap-1">
            {navItems.map((item) => (
              <button class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-default" type="button">
                <Icon icon={item.icon} class="size-5 text-muted" />
                {item.label}
              </button>
            ))}
          </nav>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Navigation />
    </div>
  );
}
