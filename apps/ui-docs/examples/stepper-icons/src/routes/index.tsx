// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { CreditCard, PackageCheck, ShoppingCart, Truck } from "lucide";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: With Icons" };

// #region demo
export function StepperIcons() {
  const items = [
    { title: "Cart", icon: ShoppingCart },
    { title: "Shipping", icon: Truck },
    { title: "Payment", icon: CreditCard },
    { title: "Delivered", icon: PackageCheck },
  ];
  return (
    <Stepper id="stepper-icons" aria-label="Order status" defaultStep={2} class="w-[560px]">
      {items.map((item) => (
        <Stepper.Step>
          <Stepper.Indicator>
            <Stepper.Icon>
              <Icon icon={item.icon} size={16} />
            </Stepper.Icon>
          </Stepper.Indicator>
          <Stepper.Content>
            <Stepper.Title>{item.title}</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      ))}
    </Stepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperIcons />
    </div>
  );
}
