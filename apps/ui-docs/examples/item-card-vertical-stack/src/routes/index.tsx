// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Cloud, Cpu, Database } from "lucide";

export const head = { title: "ItemCard: Vertical Stack" };

// #region demo
export function VerticalStack() {
  return (
    <div id="ic-vertical" class="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Cpu} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Compute</ItemCard.Title>
          <ItemCard.Description>4 vCPU</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Database} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Storage</ItemCard.Title>
          <ItemCard.Description>120 GB</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Cloud} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Region</ItemCard.Title>
          <ItemCard.Description>eu-west</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <VerticalStack />
    </div>
  );
}
