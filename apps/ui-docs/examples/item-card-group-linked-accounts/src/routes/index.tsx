// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Button } from "@rivetjs/ui/button";
import { Cloud, Mail, MessageSquare } from "lucide";

export const head = { title: "ItemCardGroup: Linked Accounts" };

// #region demo
export function LinkedAccounts() {
  return (
    <ItemCardGroup id="icg-linked" class="w-full max-w-md" aria-labelledby="icg-linked-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="icg-linked-title">Linked accounts</ItemCardGroup.Title>
        <ItemCardGroup.Description>Services that can read your workspace</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Mail} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Mail</ItemCard.Title>
          <ItemCard.Description>dana@example.com</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="tertiary">
            Disconnect
          </Button>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={MessageSquare} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Chat</ItemCard.Title>
          <ItemCard.Description>Not connected</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="secondary">
            Connect
          </Button>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Cloud} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Drive</ItemCard.Title>
          <ItemCard.Description>dana@example.com</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="tertiary">
            Disconnect
          </Button>
        </ItemCard.Action>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <LinkedAccounts />
    </div>
  );
}
