// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Chip } from "@rivetjs/ui/chip";
import { CreditCard, Wallet } from "lucide";

export const head = { title: "ItemCard: Wallet Card" };

// #region demo
export function WalletCard() {
  return (
    <div id="ic-wallet" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={CreditCard} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Visa ending 4242</ItemCard.Title>
          <ItemCard.Description>Expires 08/28</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Chip size="sm" variant="soft">
            Default
          </Chip>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Wallet} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Mastercard ending 1881</ItemCard.Title>
          <ItemCard.Description>Expires 02/27</ItemCard.Description>
        </ItemCard.Content>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WalletCard />
    </div>
  );
}
