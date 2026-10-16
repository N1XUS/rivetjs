// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/custom-toast.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastContent, ToastDescription, ToastIndicator, ToastQueue, ToastTitle } from "@rivetjs/ui/toast";
import type { ToastContentValue } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Custom Toast" };

// #region demo
// Rivet: module-level queue (a component-local queue is a different instance on the resumed page).
const customQueue = new ToastQueue({ name: "custom-toast" });

export function CustomToast() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <Toast.Provider placement="bottom" queue={customQueue}>
        {({ toast: toastItem }) => {
          const content = toastItem.content as ToastContentValue;

          return (
            <Toast class="rounded-xl border border-border" toast={toastItem} variant={content.variant}>
              <ToastContent>
                <div class="flex items-center gap-2">
                  <ToastIndicator class="text-accent-soft-foreground" variant={content.variant} />
                  <div class="flex flex-col pe-6">
                    {content.title ? <ToastTitle class="text-accent-soft-foreground">{content.title}</ToastTitle> : null}
                    {content.description ? <ToastDescription>{content.description}</ToastDescription> : null}
                  </div>
                </div>
              </ToastContent>
              <Toast.CloseButton class="absolute end-2 top-1/2 -translate-y-1/2 border-none bg-transparent opacity-100 [&>svg]:size-4" />
            </Toast>
          );
        }}
      </Toast.Provider>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          customQueue.add({
            description: "This uses a custom render function",
            title: "Custom layout toast",
            variant: "default",
          });
        }}
      >
        Custom toast
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomToast />
    </div>
  );
}
