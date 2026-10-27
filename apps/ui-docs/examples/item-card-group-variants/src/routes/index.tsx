// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Bell, User } from "lucide";

export const head = { title: "ItemCardGroup: Variants" };

// #region demo
export function Variants() {
  return (
    <div id="icg-variants" class="flex w-full max-w-md flex-col gap-4 rounded-3xl bg-background-secondary p-4">
      <ItemCardGroup id="icg-v-default" class="w-full" variant="default" aria-label="default">
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
            <ItemCard.Description>default</ItemCard.Description>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-v-secondary" class="w-full" variant="secondary" aria-label="secondary">
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
            <ItemCard.Description>secondary</ItemCard.Description>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-v-tertiary" class="w-full" variant="tertiary" aria-label="tertiary">
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
            <ItemCard.Description>tertiary</ItemCard.Description>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-v-outline" class="w-full" variant="outline" aria-label="outline">
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
            <ItemCard.Description>outline</ItemCard.Description>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-v-transparent" class="w-full" variant="transparent" aria-label="transparent">
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={User} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
            <ItemCard.Description>transparent</ItemCard.Description>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Icon>
            <Icon icon={Bell} size={18} />
          </ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>Notifications</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
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
