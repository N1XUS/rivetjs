// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { CreditCard, Landmark, Store, Truck, Wallet, Zap } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Delivery And Payment" };

// #region demo
export function DeliveryAndPayment() {
  return (
    <div class="flex w-[30rem] flex-col gap-6">
      <RadioButtonGroup class="flex-col" defaultValue="standard" name="delivery">
        <Label>Delivery</Label>
        <RadioButtonGroup.Item value="standard">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={Truck} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Standard</Label>
            <Description>3-5 business days</Description>
          </RadioButtonGroup.ItemContent>
          <span class="ms-auto text-sm font-semibold tabular-nums">Free</span>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="express">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={Zap} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Express</Label>
            <Description>Next business day</Description>
          </RadioButtonGroup.ItemContent>
          <span class="ms-auto text-sm font-semibold tabular-nums">$12</span>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="pickup">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={Store} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Pickup</Label>
            <Description>From a store near you</Description>
          </RadioButtonGroup.ItemContent>
          <span class="ms-auto text-sm font-semibold tabular-nums">Free</span>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
      <RadioButtonGroup defaultValue="card" name="payment" layout="grid">
        <Label>Payment</Label>
        <RadioButtonGroup.Item value="card">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={CreditCard} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Card</Label>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="wallet">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={Wallet} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Wallet</Label>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="bank">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <Icon icon={Landmark} />
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Bank transfer</Label>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DeliveryAndPayment />
    </div>
  );
}
