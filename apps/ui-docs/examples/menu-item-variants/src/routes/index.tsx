// Rivet-authored MenuItem demo (own content): item variants, a disabled item, a link item and a render function.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Menu } from "@rivetjs/ui/menu";
import { MenuItem } from "@rivetjs/ui/menu-item";
import type { MenuItemRenderProps } from "@rivetjs/cdk/menu";
import { Surface } from "@rivetjs/ui/surface";
import { BookOpen, LogOut, Settings, UserRound } from "lucide";

export const head = { title: "MenuItem: Variants and States" };

// #region demo
export function Variants() {
  const last = signal("none");

  return (
    <div class="flex flex-col items-center gap-3">
      <Surface class="w-72 rounded-3xl shadow-surface">
        <Menu id="menu-account" aria-label="Account" onAction={(key) => last.set(String(key))}>
          <MenuItem id="profile" textValue="Profile">
            {(state: MenuItemRenderProps) => (
              <>
                <Icon icon={UserRound} size={16} class={state.isFocused() ? "text-accent" : "text-muted"} />
                <div class="flex flex-col">
                  <Label>Profile</Label>
                  <Description>{state.isFocused() ? "Press Enter to open" : "Name, photo and bio"}</Description>
                </div>
              </>
            )}
          </MenuItem>
          <MenuItem id="settings" textValue="Settings">
            <Icon icon={Settings} size={16} class="text-muted" />
            <Label>Settings</Label>
          </MenuItem>
          <MenuItem id="docs" textValue="Documentation" href="#menu-account" isDisabled>
            <Icon icon={BookOpen} size={16} class="text-muted" />
            <Label>Documentation</Label>
          </MenuItem>
          <MenuItem id="sign-out" textValue="Sign out" variant="danger">
            <Icon icon={LogOut} size={16} class="text-danger" />
            <Label>Sign out</Label>
          </MenuItem>
        </Menu>
      </Surface>
      <p id="menu-account-last" class="text-sm text-muted">
        Last action: {last()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
