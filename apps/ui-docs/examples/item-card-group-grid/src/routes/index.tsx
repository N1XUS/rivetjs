// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Calendar, FileText, Image, Music } from "lucide";

export const head = { title: "ItemCardGroup: Grid" };

// #region demo
export function Grid() {
  return (
    <ItemCardGroup id="icg-grid" class="w-full max-w-xl" layout="grid" aria-label="Storage">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={FileText} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Documents</ItemCard.Title>
          <ItemCard.Description>1,204 files</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Image} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Photos</ItemCard.Title>
          <ItemCard.Description>8,310 files</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Music} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Audio</ItemCard.Title>
          <ItemCard.Description>412 files</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Calendar} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Events</ItemCard.Title>
          <ItemCard.Description>96 items</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Grid />
    </div>
  );
}
