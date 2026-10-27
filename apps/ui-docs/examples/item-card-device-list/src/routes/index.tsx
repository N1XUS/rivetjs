// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { Laptop, Smartphone, Tablet } from "lucide";

export const head = { title: "ItemCard: Device List" };

// #region demo
export function DeviceList() {
  return (
    <div id="ic-devices" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Laptop} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>MacBook Pro</ItemCard.Title>
          <ItemCard.Description>Lisbon · Chrome</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Chip size="sm" color="success" variant="soft">
            This device
          </Chip>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Smartphone} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Pixel 9</ItemCard.Title>
          <ItemCard.Description>Porto · App · 2 hours ago</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="tertiary">
            Sign out
          </Button>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Tablet} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>iPad Air</ItemCard.Title>
          <ItemCard.Description>Madrid · Safari · 3 days ago</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="tertiary">
            Sign out
          </Button>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DeviceList />
    </div>
  );
}
