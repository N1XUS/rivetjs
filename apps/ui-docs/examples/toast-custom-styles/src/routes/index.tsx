// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastContent, ToastDescription, ToastIndicator, ToastQueue, ToastTitle } from "@rivetjs/ui/toast";
import type { ToastContentValue } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Custom Styles" };

// #region demo
// Rivet: module-level queue (a component-local queue is a different instance on the resumed page).
const queue = new ToastQueue({ name: "custom-styles" });

export function CustomStyles() {
  return (
    <div class="flex flex-col items-center gap-4">
      <Toast.Provider placement="bottom" queue={queue}>
        {({ toast: toastItem }) => {
          const content = toastItem.content as ToastContentValue;

          return (
            <Toast
              class="rounded-xl border border-border/80 bg-surface shadow-lg ring-1 ring-black/5 dark:ring-white/10"
              toast={toastItem}
              variant={content.variant}
            >
              <ToastContent>
                <div class="flex items-center gap-2.5">
                  <ToastIndicator class="text-neutral-600 dark:text-neutral-400" variant={content.variant} />
                  <div class="flex flex-col gap-0.5">
                    {content.title ? <ToastTitle class="text-sm font-medium text-neutral-900 dark:text-neutral-50">{content.title}</ToastTitle> : null}
                    {content.description ? (
                      <ToastDescription class="text-sm text-neutral-600 dark:text-neutral-400">{content.description}</ToastDescription>
                    ) : null}
                  </div>
                </div>
              </ToastContent>
            </Toast>
          );
        }}
      </Toast.Provider>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          queue.add({
            description: "Draft synced",
            title: "Saved",
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
      <CustomStyles />
    </div>
  );
}
