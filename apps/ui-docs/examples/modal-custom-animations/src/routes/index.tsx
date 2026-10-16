// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/custom-animations.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUpFromLine, Sparkles } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Custom Animations" };

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
        "Physics-based elastic scaling. Simulates a high-damping spring system with fast transient response and prolonged settling time. Ideal for Modals and Popovers.",
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
      {animations.map(({ classNames, description, icon, name }) => (
        <Modal>
          <Button variant="secondary">{name}</Button>
          <Modal.Backdrop class={classNames.backdrop}>
            <Modal.Container class={classNames.container}>
              <Modal.Dialog class="sm:max-w-[360px]">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Icon class="bg-default text-foreground">
                    <Icon icon={iconMap[icon]} class="size-5" />
                  </Modal.Icon>
                  <Modal.Heading>{name} Animation</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p class="mt-1">{description}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="tertiary">
                    Close
                  </Button>
                  <Button slot="close">Try Again</Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ))}
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
