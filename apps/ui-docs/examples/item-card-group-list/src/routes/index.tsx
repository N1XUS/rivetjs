// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Switch } from "@rivetjs/ui/switch";
import { Bluetooth, Plane, Wifi } from "lucide";

export const head = { title: "ItemCardGroup: List" };

// #region demo
export function List() {
  return (
    <ItemCardGroup id="icg-list" class="w-full max-w-md" aria-label="Connectivity">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Plane} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Airplane mode</ItemCard.Title>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Airplane mode">
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
          <Icon icon={Wifi} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Wi-Fi</ItemCard.Title>
          <ItemCard.Description>Home</ItemCard.Description>
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
          <Icon icon={Bluetooth} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Bluetooth</ItemCard.Title>
          <ItemCard.Description>2 devices</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Bluetooth" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <List />
    </div>
  );
}
