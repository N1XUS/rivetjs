// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { HardDrive, Users } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { toast, Toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <div class="flex w-full flex-wrap items-center justify-center gap-4">
        <Button
          size="sm"
          variant="tertiary"
          onPress={() => {
            const id = toast("You have been invited to join a team", {
              actionProps: {
                children: "Dismiss",
                onPress: () => toast.close(id),
                variant: "tertiary",
              },
              description: "Bob sent you an invitation to join the Acme team",
              indicator: <Icon icon={Users} />,
              variant: "default",
            });
          }}
        >
          Default toast
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const id = toast.info("You have 2 credits left", {
              actionProps: { children: "Upgrade", onPress: () => toast.close(id) },
              description: "Get a paid plan for more credits",
            });
          }}
        >
          Accent toast
        </Button>
        <Button
          class="text-success-soft-foreground"
          size="sm"
          variant="tertiary"
          onPress={() => {
            const id = toast.success("You have upgraded your plan", {
              actionProps: {
                children: "Billing",
                class: "bg-success text-success-foreground",
                onPress: () => toast.close(id),
              },
              description: "You can continue using Acme Chat",
            });
          }}
        >
          Success toast
        </Button>
        <Button
          class="text-warning-soft-foreground"
          size="sm"
          variant="tertiary"
          onPress={() => {
            const id = toast.warning("You have no credits left", {
              actionProps: {
                children: "Upgrade",
                class: "bg-warning text-warning-foreground",
                onPress: () => toast.close(id),
              },
              description: "Upgrade to a paid plan to continue",
            });
          }}
        >
          Warning toast
        </Button>
        <Button
          size="sm"
          variant="danger-soft"
          onPress={() => {
            const id = toast.danger("Storage is full", {
              actionProps: { children: "Remove", onPress: () => toast.close(id), variant: "danger" },
              description: "Remove files to release space. Adding more text to demonstrate longer content display",
              indicator: <Icon icon={HardDrive} />,
            });
          }}
        >
          Danger toast
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Toast.Provider />
      <Variants />
    </div>
  );
}
