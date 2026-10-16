// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/custom-trigger.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { LogOut, Settings, Users } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";

export const head = { title: "Dropdown: Custom Trigger" };

// #region demo
export function CustomTrigger() {
  return (
    <Dropdown>
      <Dropdown.Trigger class="rounded-full">
        <Avatar>
          <Avatar.Image alt="Junior Garcia" src={avatarOrangeImage.src} />
          <Avatar.Fallback delayMs={600}>JD</Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <div class="px-3 pt-3 pb-1">
          <div class="flex items-center gap-2">
            <Avatar size="sm">
              <Avatar.Image alt="Jane" src={avatarOrangeImage.src} />
              <Avatar.Fallback delayMs={600}>JD</Avatar.Fallback>
            </Avatar>
            <div class="flex flex-col gap-0">
              <p class="text-sm leading-5 font-medium">Jane Doe</p>
              <p class="text-xs leading-none text-muted">jane@example.com</p>
            </div>
          </div>
        </div>
        <Dropdown.Menu>
          <Dropdown.Item id="dashboard">Dashboard</Dropdown.Item>
          <Dropdown.Item id="profile">Profile</Dropdown.Item>
          <Dropdown.Item id="settings" textValue="Settings">
            <div class="flex w-full items-center justify-between gap-2">
              <Label>Settings</Label>
              <Icon icon={Settings} size={16} class="size-3.5 text-muted" />
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="new-project" textValue="New project">
            <div class="flex w-full items-center justify-between gap-2">
              <Label>Create Team</Label>
              <Icon icon={Users} size={16} class="size-3.5 text-muted" />
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="Logout" variant="danger">
            <div class="flex w-full items-center justify-between gap-2">
              <Label>Log Out</Label>
              <Icon icon={LogOut} size={16} class="size-3.5 text-danger" />
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomTrigger />
    </div>
  );
}
