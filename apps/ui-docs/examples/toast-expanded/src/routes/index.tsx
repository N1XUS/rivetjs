// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/expanded.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastQueue } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Expanded" };

// #region demo
// Rivet: a named queue (several queues on one page need distinct names on a resumed page).
const queue = new ToastQueue({ name: "expanded" });

export function Expanded() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <Toast.Provider isExpanded aria-label="Expanded notifications" placement="bottom" queue={queue} />
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          queue.add({
            title: "Simple message",
            variant: "default",
          });
          setTimeout(() => {
            queue.add({
              title: "Operation completed",
              variant: "success",
            });
          }, 400);
          setTimeout(() => {
            queue.add({
              title: "New update available",
              variant: "accent",
            });
          }, 800);
        }}
      >
        Show 3 toasts
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Expanded />
    </div>
  );
}
