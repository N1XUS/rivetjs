// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Switch } from "@rivetjs/ui/switch";
import { AtSign, MessageCircle, UserPlus } from "lucide";

export const head = { title: "ItemCardGroup: Notification Preferences" };

// #region demo
export function NotificationPreferences() {
  return (
    <ItemCardGroup id="icg-notify" class="w-full max-w-md" aria-labelledby="icg-notify-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="icg-notify-title">Notifications</ItemCardGroup.Title>
        <ItemCardGroup.Description>Choose what you hear about</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={AtSign} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Mentions</ItemCard.Title>
          <ItemCard.Description>When someone @mentions you</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Mentions" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={MessageCircle} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Replies</ItemCard.Title>
          <ItemCard.Description>Replies to your threads</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Replies" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={UserPlus} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>New followers</ItemCard.Title>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="New followers">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <NotificationPreferences />
    </div>
  );
}
