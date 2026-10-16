// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/simple.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { toast, Toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Simple Toasts" };

// #region demo
export function Simple() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <div class="flex w-full flex-wrap items-center justify-center gap-4">
        <Button size="sm" variant="secondary" onPress={() => toast("Simple message")}>
          Default
        </Button>
        <Button size="sm" variant="secondary" onPress={() => toast.success("Operation completed")}>
          Success
        </Button>
        <Button size="sm" variant="secondary" onPress={() => toast.info("New update available")}>
          Info
        </Button>
        <Button size="sm" variant="secondary" onPress={() => toast.warning("Please check your settings")}>
          Warning
        </Button>
        <Button size="sm" variant="secondary" onPress={() => toast.danger("Something went wrong")}>
          Error
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
      <Simple />
    </div>
  );
}
