// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/features-and-addons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bell, Mail, MessageCircle } from "lucide";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Features and Add-ons Example" };

// #region demo
export function FeaturesAndAddOns() {
  const addOns = [
    {
      description: "Receive updates via email",
      icon: Mail,
      title: "Email Notifications",
      value: "email",
    },
    {
      description: "Get instant SMS notifications",
      icon: MessageCircle,
      title: "SMS Alerts",
      value: "sms",
    },
    {
      description: "Browser and mobile push alerts",
      icon: Bell,
      title: "Push Notifications",
      value: "push",
    },
  ];

  return (
    <div class="flex w-full flex-col items-center gap-10 px-4 py-8">
      <section class="flex w-full min-w-[320px] flex-col gap-4">
        <CheckboxGroup name="notification-preferences">
          <Label>Notification preferences</Label>
          <Description>Choose how you want to receive updates</Description>
          <div class="flex flex-col gap-2">
            {addOns.map((addon) => (
              <Checkbox value={addon.value} variant="secondary">
                <Checkbox.Content class="group relative flex w-full flex-row items-start justify-start gap-4 rounded-3xl bg-surface px-5 py-4 transition-all data-[selected=true]:bg-accent/10">
                  <Checkbox.Control class="absolute end-4 top-3 size-5 rounded-full before:rounded-full">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Icon class="size-5 text-accent-soft-foreground" icon={addon.icon} />
                  <div class="flex flex-col gap-1">
                    <span>{addon.title}</span>
                    <Description>{addon.description}</Description>
                  </div>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </CheckboxGroup>
      </section>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FeaturesAndAddOns />
    </div>
  );
}
