// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Users } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { toast, Toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Usage" };

// #region demo
export function Default() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <Button
        size="sm"
        variant="secondary"
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
        Show toast
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Toast.Provider />
      <Default />
    </div>
  );
}
