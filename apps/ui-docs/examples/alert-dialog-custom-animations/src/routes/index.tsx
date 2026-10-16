// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-animations.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUpFromLine, Sparkles } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Custom Animations" };

// #region demo
const iconMap = {
  "gravity-ui:arrow-up-from-line": ArrowUpFromLine,
  "gravity-ui:sparkles": Sparkles,
};

export function CustomAnimations() {
  const animations = [
    {
      classNames: {
        backdrop: [
          "data-[entering]:duration-400",
          "data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[exiting]:duration-200",
          "data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
        ].join(" "),
        container: [
          "data-[entering]:animate-in",
          "data-[entering]:fade-in-0",
          "data-[entering]:zoom-in-95",
          "data-[entering]:duration-400",
          "data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[exiting]:animate-out",
          "data-[exiting]:fade-out-0",
          "data-[exiting]:zoom-out-95",
          "data-[exiting]:duration-200",
          "data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
        ].join(" "),
      },
      description:
        "Physics-based elastic scaling. Simulates a high-damping spring system with fast transient response and prolonged settling time. Ideal for Alert Dialogs and Modals.",
      icon: "gravity-ui:sparkles" as const,
      name: "Kinematic Scale",
    },
    {
      classNames: {
        backdrop: [
          "data-[entering]:duration-500",
          "data-[entering]:ease-[cubic-bezier(0.25,1,0.5,1)]",
          "data-[exiting]:duration-200",
          "data-[exiting]:ease-[cubic-bezier(0.5,0,0.75,0)]",
        ].join(" "),
        container: [
          "data-[entering]:animate-in",
          "data-[entering]:fade-in-0",
          "data-[entering]:slide-in-from-bottom-4",
          "data-[entering]:duration-500",
          "data-[entering]:ease-[cubic-bezier(0.25,1,0.5,1)]",
          "data-[exiting]:animate-out",
          "data-[exiting]:fade-out-0",
          "data-[exiting]:slide-out-to-bottom-2",
          "data-[exiting]:duration-200",
          "data-[exiting]:ease-[cubic-bezier(0.5,0,0.75,0)]",
        ].join(" "),
      },
      description:
        "Simulates movement through a medium with fluid resistance. Eliminates mechanical linearity for a natural, grounded feel. Perfect for Bottom Sheets or Toasts.",
      icon: "gravity-ui:arrow-up-from-line" as const,
      name: "Fluid Slide",
    },
  ];

  return (
    <div class="flex flex-wrap gap-4">
      {animations.map(({ classNames, description, icon, name }) => {
        const IconComponent = iconMap[icon];

        return (
          <AlertDialog>
            <Button variant="secondary">{name}</Button>
            <AlertDialog.Backdrop class={classNames.backdrop}>
              <AlertDialog.Container class={classNames.container}>
                <AlertDialog.Dialog class="sm:max-w-[400px]">
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="accent">{!!IconComponent && <Icon icon={IconComponent} class="size-5" />}</AlertDialog.Icon>
                    <AlertDialog.Heading>{name} Animation</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p class="mt-1">{description}</p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button slot="close" variant="tertiary">
                      Close
                    </Button>
                    <Button slot="close">Try Again</Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
        );
      })}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomAnimations />
    </div>
  );
}
