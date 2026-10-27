// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ChevronRight, CreditCard, Shield, User } from "lucide";

export const head = { title: "ItemCard: Pressable" };

// #region demo
export function Pressable() {
  return (
    <div id="ic-pressable" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard render={(props) => <a href="#profile" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={User} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Profile</ItemCard.Title>
          <ItemCard.Description>Name, photo, bio</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
      <ItemCard render={(props) => <a href="#security" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={Shield} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Security</ItemCard.Title>
          <ItemCard.Description>Password, two-factor</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
      <ItemCard render={(props) => <a href="#billing" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={CreditCard} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Billing</ItemCard.Title>
          <ItemCard.Description>Plan, invoices</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Pressable />
    </div>
  );
}
