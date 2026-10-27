// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Bell, ChevronRight, Globe, Lock, Palette, User } from "lucide";

export const head = { title: "ItemCardGroup: Multiple Sections" };

// #region demo
export function MultipleSections() {
  return (
    <div id="icg-sections" class="flex w-full max-w-md flex-col gap-6">
      <ItemCardGroup id="icg-sec-account" class="w-full" aria-labelledby="icg-sec-account-title">
        <ItemCardGroup.Header>
          <ItemCardGroup.Title id="icg-sec-account-title">Account</ItemCardGroup.Title>
        </ItemCardGroup.Header>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Profile</ItemCard.Title>
          </ItemCard.Content>
          <ItemCard.Action>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </ItemCard.Action>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Lock} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Password</ItemCard.Title>
          </ItemCard.Content>
          <ItemCard.Action>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </ItemCard.Action>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-sec-app" class="w-full" aria-labelledby="icg-sec-app-title">
        <ItemCardGroup.Header>
          <ItemCardGroup.Title id="icg-sec-app-title">App</ItemCardGroup.Title>
        </ItemCardGroup.Header>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Palette} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Appearance</ItemCard.Title>
            <ItemCard.Description>System</ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </ItemCard.Action>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Globe} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Language</ItemCard.Title>
            <ItemCard.Description>English</ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </ItemCard.Action>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
          <ItemCard.Action>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </ItemCard.Action>
        </ItemCard>
      </ItemCardGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <MultipleSections />
    </div>
  );
}
