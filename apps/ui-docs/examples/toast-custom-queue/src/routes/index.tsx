// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/custom-queue.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastQueue } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Custom Queue" };

// #region demo
// Rivet: module-level queues with distinct names (a component-local queue is a different instance on the resumed page).
const notificationQueue = new ToastQueue({ maxVisibleToasts: 2, name: "notifications" });
const errorQueue = new ToastQueue({ maxVisibleToasts: 3, name: "errors" });
const successQueue = new ToastQueue({ maxVisibleToasts: 1, name: "successes" });

export function CustomQueue() {
  return (
    <div class="flex h-full max-w-4xl items-center justify-center gap-4">
      {/* Notification Queue */}
      <Toast.Provider placement="bottom" queue={notificationQueue} />
      <div class="flex justify-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            notificationQueue.add({
              description: "You have a new message",
              title: "New notification",
              variant: "default",
            });
          }}
        >
          Add notification (max 2)
        </Button>
      </div>

      {/* Error Queue */}
      <Toast.Provider placement="bottom start" queue={errorQueue} />
      <div class="flex justify-center gap-2">
        <Button
          size="sm"
          variant="danger-soft"
          onPress={() => {
            errorQueue.add({
              description: "Failed to save changes",
              title: "Error occurred",
              variant: "danger",
            });
          }}
        >
          Add error (max 3)
        </Button>
      </div>

      {/* Success Queue */}
      <Toast.Provider placement="bottom end" queue={successQueue} />
      <div class="flex justify-center gap-2">
        <Button
          class="text-success-soft-foreground"
          size="sm"
          variant="secondary"
          onPress={() => {
            successQueue.add({
              description: `Operation ${Date.now()}`,
              title: "Success!",
              variant: "success",
            });
          }}
        >
          Add success (max 1)
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomQueue />
    </div>
  );
}
