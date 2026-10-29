// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { House, Package, PackageCheck, Truck } from "lucide";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Package Tracking" };

// #region demo
export function StepperPackageTracking() {
  const events = [
    { title: "Ordered", time: "Mon, 3 Jun", icon: Package },
    { title: "Shipped", time: "Tue, 4 Jun", icon: Truck },
    { title: "Out for delivery", time: "Today, 09:12", icon: PackageCheck },
    { title: "Delivered", time: "Expected by 18:00", icon: House },
  ];
  return (
    <div class="flex w-[640px] flex-col gap-6 rounded-3xl bg-surface p-6 shadow-surface">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <span class="text-xs text-muted">Order RV-20419</span>
          <span class="text-base font-semibold">Arriving today</span>
        </div>
        <span class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">In transit</span>
      </div>
      <Stepper id="stepper-package-tracking" aria-label="Shipment progress" defaultStep={2}>
        {events.map((event, index) => (
          <Stepper.Step>
            <Stepper.Indicator>
              <Stepper.Icon>
                <Icon icon={event.icon} size={16} />
              </Stepper.Icon>
            </Stepper.Indicator>
            <Stepper.Content>
              <Stepper.Title>{event.title}</Stepper.Title>
              <Stepper.Description>{event.time}</Stepper.Description>
            </Stepper.Content>
            {/* The courier is on the way: the separator after the current step is half filled. */}
            <Stepper.Separator progress={index === 2 ? 0.5 : undefined} />
          </Stepper.Step>
        ))}
      </Stepper>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperPackageTracking />
    </div>
  );
}
