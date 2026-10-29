// Rivet-authored ItemCardGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { ChevronRight, HardDrive, Laptop } from "lucide";

export const head = { title: "ItemCardGroup: With Header" };

// #region demo
export function WithHeader() {
  return (
    <ItemCardGroup id="icg-header" class="w-full max-w-md" aria-labelledby="icg-header-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="icg-header-title">Backups</ItemCardGroup.Title>
        <ItemCardGroup.Description>Automatic, every hour</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Laptop} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>This Mac</ItemCard.Title>
          <ItemCard.Description>Backed up 2 h ago</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={HardDrive} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>External disk</ItemCard.Title>
          <ItemCard.Description>Last backup 4 days ago</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithHeader />
    </div>
  );
}
