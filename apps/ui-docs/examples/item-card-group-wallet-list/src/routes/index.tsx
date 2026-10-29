// Rivet-authored ItemCardGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Chip } from "@rivetjs/ui/chip";
import { CreditCard, Plus, Wallet } from "lucide";

export const head = { title: "ItemCardGroup: Wallet List" };

// #region demo
export function WalletList() {
  return (
    <ItemCardGroup id="icg-wallet" class="w-full max-w-md" aria-labelledby="icg-wallet-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="icg-wallet-title">Payment methods</ItemCardGroup.Title>
      </ItemCardGroup.Header>
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
      <ItemCard render={(props) => <a href="#add" {...props} />}>
        <ItemCard.Icon>
          <Icon icon={Plus} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Add payment method</ItemCard.Title>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WalletList />
    </div>
  );
}
