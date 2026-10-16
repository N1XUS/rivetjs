// Rivet-authored ListBox demo (no HeroUI counterpart): settings rows that open their settings in place with `@rivetjs/ui/item-morph`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Bell, ChevronRight, Wifi } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { ItemMorph, itemMorphProps, useItemMorph } from "@rivetjs/ui/item-morph";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Surface } from "@rivetjs/ui/surface";
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "ListBox: Item Morph (inline settings)" };

// #region demo
export function InlineSettings() {
  const wifi = signal(true);
  const askToJoin = signal(false);
  const notifications = signal(true);
  const sounds = signal(true);
  // A press (click, Enter, tap) opens the row's panel: the list has no selection, so the press is the row's action.
  const settings = useItemMorph({ trigger: "press" });

  return (
    <Surface class="w-[288px] rounded-3xl shadow-surface">
      <ListBox aria-label="Settings">
        <ListBox.Item id="wifi" textValue="Wi-Fi" {...itemMorphProps(settings)}>
          <Icon icon={Wifi} size={16} />
          <Label class="flex-1">Wi-Fi</Label>
          <Description>{() => (wifi() ? "On" : "Off")}</Description>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ListBox.Item>
        <ListBox.Item id="notifications" textValue="Notifications" {...itemMorphProps(settings)}>
          <Icon icon={Bell} size={16} />
          <Label class="flex-1">Notifications</Label>
          <Description>{() => (notifications() ? "On" : "Off")}</Description>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ListBox.Item>
      </ListBox>

      <ItemMorph morph={settings} backdrop="transparent" panelClass="w-[288px]">
        {(key) =>
          key() === "wifi" ? (
            <>
              <Switch isSelected={wifi}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Wi-Fi
                </Switch.Content>
              </Switch>
              <Switch isSelected={askToJoin}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Ask to join networks
                </Switch.Content>
              </Switch>
              <ItemMorph.Close size="sm">Done</ItemMorph.Close>
            </>
          ) : (
            <>
              <Switch isSelected={notifications}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Allow notifications
                </Switch.Content>
              </Switch>
              <Switch isSelected={sounds}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Sounds
                </Switch.Content>
              </Switch>
              <ItemMorph.Close size="sm">Done</ItemMorph.Close>
            </>
          )
        }
      </ItemMorph>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InlineSettings />
    </div>
  );
}
