// Rivet-authored ItemCardGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Box, Database, Globe, KeyRound, Server, Shield } from "lucide";

export const head = { title: "ItemCardGroup: Grid Three Columns" };

// #region demo
export function GridThree() {
  return (
    <ItemCardGroup id="icg-grid-3" class="w-full max-w-3xl" layout="grid" columns={3} aria-label="Resources">
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Server} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Compute</ItemCard.Title>
          <ItemCard.Description>12 instances</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Database} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Databases</ItemCard.Title>
          <ItemCard.Description>3 clusters</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Box} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Storage</ItemCard.Title>
          <ItemCard.Description>8 buckets</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Globe} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>CDN</ItemCard.Title>
          <ItemCard.Description>2 zones</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={Shield} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Firewall</ItemCard.Title>
          <ItemCard.Description>14 rules</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard class="flex-col items-start">
        <ItemCard.Icon>
          <Icon icon={KeyRound} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Secrets</ItemCard.Title>
          <ItemCard.Description>31 keys</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <GridThree />
    </div>
  );
}
