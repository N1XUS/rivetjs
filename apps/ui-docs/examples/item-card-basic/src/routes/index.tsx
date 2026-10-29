// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Switch } from "@rivetjs/ui/switch";
import { Bell } from "lucide";

export const head = { title: "ItemCard: Usage" };

// #region demo
export function Basic() {
  return (
    <div id="ic-basic" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Bell} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Push notifications</ItemCard.Title>
          <ItemCard.Description>Alerts on this device</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Push notifications" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
