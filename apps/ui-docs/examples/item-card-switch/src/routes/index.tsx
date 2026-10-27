// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Switch } from "@rivetjs/ui/switch";
import { MapPin, Wifi } from "lucide";

export const head = { title: "ItemCard: With Switch" };

// #region demo
export function WithSwitch() {
  return (
    <div id="ic-switch" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Wifi} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Wi-Fi</ItemCard.Title>
          <ItemCard.Description>Connected to Home</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Wi-Fi" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={MapPin} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Location</ItemCard.Title>
          <ItemCard.Description>Used for local results</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Location">
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
      <WithSwitch />
    </div>
  );
}
