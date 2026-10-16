// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/placements.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastQueue } from "@rivetjs/ui/toast";
import type { ToastVariants } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Placements" };

// #region demo
type Placement = NonNullable<ToastVariants["placement"]>;

const placements = ["top start", "top", "top end", "bottom start", "bottom", "bottom end"] as const;

// Create a separate queue for each placement (Rivet: a distinct `name` per queue)
const placementQueues = Object.fromEntries(placements.map((p) => [p, new ToastQueue({ maxVisibleToasts: 3, name: `placement-${p}` })])) as Record<
  Placement,
  ToastQueue
>;

export function Placements() {
  const showToast = (placement: Placement) => {
    placementQueues[placement].add({
      description: "Event has been created",
      title: "Event created",
      variant: "default",
    });
  };

  return (
    <div class="flex h-full flex-col items-center justify-center gap-6">
      {/* Render a ToastProvider for each placement */}
      {placements.map((p) => (
        <Toast.Provider placement={p} queue={placementQueues[p]} />
      ))}
      <div class="flex max-w-xs flex-wrap justify-center gap-2">
        {placements.map((p) => (
          <Button size="sm" variant="secondary" onPress={() => showToast(p)}>
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placements />
    </div>
  );
}
