// Rivet-authored ItemCard demo (Rivet addition, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Badge } from "@rivetjs/ui/badge";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ClipboardList, Mail, MessageSquare, Pin, ShoppingBag } from "lucide";

export const head = { title: "ItemCard: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex w-full max-w-md flex-col gap-3">
      <ItemCard id="ic-indicator-dot" variant="secondary">
        <ItemCard.Icon>
          <Icon icon={Mail} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title class="font-semibold">Nora Berg</ItemCard.Title>
          <ItemCard.Description>Packaging proofs are ready</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Indicator aria-label="Unread" />
      </ItemCard>
      <ItemCard id="ic-indicator-count" variant="secondary">
        <ItemCard.Icon>
          <Icon icon={ShoppingBag} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title class="font-semibold">Orders</ItemCard.Title>
          <ItemCard.Description>New orders since this morning</ItemCard.Description>
        </ItemCard.Content>
        {/* A Badge is placed on an anchor corner by default: static + transform-none keep it in the row. */}
        <ItemCard.Indicator aria-label="12 new">
          <Badge color="accent" size="sm" class="static transform-none">
            <Badge.Label>12</Badge.Label>
          </Badge>
        </ItemCard.Indicator>
      </ItemCard>
      <ItemCard id="ic-indicator-icon" variant="secondary">
        <ItemCard.Icon>
          <Icon icon={ClipboardList} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Supplier list</ItemCard.Title>
          <ItemCard.Description>Kept at the top of the board</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Indicator aria-label="Pinned" class="text-muted">
          <Icon icon={Pin} size={16} />
        </ItemCard.Indicator>
      </ItemCard>
      <ItemCard id="ic-indicator-read" variant="secondary">
        <ItemCard.Icon>
          <Icon icon={MessageSquare} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Lukas Brenner</ItemCard.Title>
          <ItemCard.Description>Read: no indicator</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Indicator />
    </div>
  );
}
