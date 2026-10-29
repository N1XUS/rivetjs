// Rivet-authored ItemCardGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Bell, ChevronRight, Lock, User } from "lucide";

export const head = { title: "ItemCardGroup: Pressable" };

// #region demo
export function Pressable() {
  return (
    <ItemCardGroup id="icg-pressable" class="w-full max-w-md" aria-label="Settings">
      <ItemCard render={(props) => <a href="#account" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={User} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Account</ItemCard.Title>
          <ItemCard.Description>Name, email, avatar</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
      <ItemCard render={(props) => <a href="#notifications" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={Bell} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Notifications</ItemCard.Title>
          <ItemCard.Description>Email and push</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Icon icon={ChevronRight} size={16} class="text-muted" />
        </ItemCard.Action>
      </ItemCard>
      <ItemCard render={(props) => <a href="#privacy" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={Lock} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Privacy</ItemCard.Title>
          <ItemCard.Description>Who can see your activity</ItemCard.Description>
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
      <Pressable />
    </div>
  );
}
