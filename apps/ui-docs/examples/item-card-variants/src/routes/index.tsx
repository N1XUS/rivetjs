// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Layers } from "lucide";

export const head = { title: "ItemCard: Variants" };

// #region demo
export function Variants() {
  return (
    <div id="ic-variants" class="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-background-secondary p-4">
      <ItemCard variant="default">
        <ItemCard.Icon>
          <Icon icon={Layers} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Default</ItemCard.Title>
          <ItemCard.Description>variant="default"</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard variant="secondary">
        <ItemCard.Icon>
          <Icon icon={Layers} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Secondary</ItemCard.Title>
          <ItemCard.Description>variant="secondary"</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard variant="tertiary">
        <ItemCard.Icon>
          <Icon icon={Layers} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Tertiary</ItemCard.Title>
          <ItemCard.Description>variant="tertiary"</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard variant="outline">
        <ItemCard.Icon>
          <Icon icon={Layers} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Outline</ItemCard.Title>
          <ItemCard.Description>variant="outline"</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard variant="transparent">
        <ItemCard.Icon>
          <Icon icon={Layers} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Transparent</ItemCard.Title>
          <ItemCard.Description>variant="transparent"</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Variants />
    </div>
  );
}
