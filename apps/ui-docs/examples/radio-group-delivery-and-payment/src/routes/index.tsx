// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/delivery-and-payment.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CreditCard, Wallet } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Delivery & Payment" };

// #region demo
// Rivet: upstream's Iconify brand logos (Mastercard, Visa, PayPal) → lucide `CreditCard` / `Wallet` (icon rule: lucide only).

export function DeliveryAndPayment() {
  const deliveryOptions = [
    {
      description: "4-10 business days",
      price: "$5.00",
      title: "Standard",
      value: "standard",
    },
    {
      description: "2-5 business days",
      price: "$16.00",
      title: "Express",
      value: "express",
    },
    {
      description: "1 business day",
      price: "$25.00",
      title: "Super Fast",
      value: "super-fast",
    },
  ];

  const paymentOptions = [
    {
      description: "Exp. on 01/2026",
      icon: CreditCard,
      title: "**** 8304",
      value: "mastercard",
    },
    {
      description: "Exp. on 01/2026",
      icon: CreditCard,
      title: "**** 0123",
      value: "visa",
    },
    {
      description: "Pay with PayPal",
      icon: Wallet,
      title: "PayPal",
      value: "paypal",
    },
  ];

  return (
    <div
      class="flex w-full flex-col items-center gap-10"
      style={{
        "--accent": "#006FEE",
        "--accent-foreground": "#fff",
        "--accent-hover": "#006FEE",
        "--border-width": "2px",
        "--border-width-field": "2px",
        "--focus": "#006FEE",
      }}
    >
      <section class="flex w-full max-w-lg flex-col gap-4">
        <RadioGroup defaultValue="express" name="delivery" variant="secondary">
          <Label>Delivery method</Label>
          <div class="grid gap-x-4 md:grid-cols-3">
            {deliveryOptions.map((option) => (
              <Radio value={option.value}>
                <Radio.Content class="group relative flex w-full flex-col gap-6 rounded-xl border border-transparent bg-surface px-5 py-4 transition-all data-[selected=true]:border-accent data-[selected=true]:bg-accent/10 data-[focus-visible=true]:border-accent data-[focus-visible=true]:bg-accent/10">
                  <Radio.Control class="absolute end-4 top-3 size-5">
                    <Radio.Indicator />
                  </Radio.Control>
                  <div class="flex flex-col gap-1">
                    <span>{option.title}</span>
                    <Description>{option.description}</Description>
                  </div>
                  <span class="text-sm font-semibold">{option.price}</span>
                </Radio.Content>
              </Radio>
            ))}
          </div>
        </RadioGroup>
      </section>
      <section class="flex w-full max-w-lg flex-col gap-4">
        <RadioGroup defaultValue="visa" name="payment" variant="secondary">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <Label>Payment method</Label>
          </div>
          <div class="grid gap-x-4 md:grid-cols-2">
            {paymentOptions.map((option) => (
              <Radio value={option.value}>
                <Radio.Content class="group relative flex w-full flex-row items-start justify-start gap-4 rounded-xl border border-transparent bg-surface px-5 py-4 transition-all data-[selected=true]:border-accent data-[selected=true]:bg-accent/10">
                  <Radio.Control class="absolute end-4 top-3 size-5">
                    <Radio.Indicator />
                  </Radio.Control>
                  <Icon class="size-6" icon={option.icon} />
                  <div class="flex flex-col gap-1">
                    <span>{option.title}</span>
                    <Description>{option.description}</Description>
                  </div>
                </Radio.Content>
              </Radio>
            ))}
          </div>
        </RadioGroup>
      </section>
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
