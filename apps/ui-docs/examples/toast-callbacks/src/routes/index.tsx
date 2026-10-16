// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/callbacks.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { toast, Toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Callbacks" };

// #region demo
export function Callbacks() {
  const closedHistory = signal<Array<{ message: string; time: string }>>([]);

  const addToHistory = (message: string) => {
    const time = new Date().toLocaleTimeString();

    closedHistory.set([{ message, time }, ...closedHistory()].slice(0, 5));
  };

  return (
    <div class="flex h-full max-w-2xl flex-col items-center justify-center gap-6">
      {/* Toast Buttons */}
      <div class="flex w-full flex-wrap items-center justify-center gap-4">
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast("File saved", {
              onClose: () => {
                addToHistory("File saved (closed after 3 seconds)");
              },
              timeout: 3000,
            })
          }
        >
          Custom timeout (3s)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast("Changes saved", {
              onClose: () => {
                addToHistory("Changes saved (closed after 10 seconds)");
              },
              timeout: 10000,
            })
          }
        >
          Custom timeout (10s)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast.success("Event created", {
              onClose: () => {
                addToHistory("Event created (closed after default timeout)");
              },
            })
          }
        >
          With onClose callback
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast("Important notification", {
              description: "This toast will stay until dismissed",
              onClose: () => {
                addToHistory("Important notification (manually closed)");
              },
              timeout: 0,
            })
          }
        >
          Persistent toast
        </Button>
      </div>

      {/* Closed History Panel */}
      <div class="w-full space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">Closed History</h3>
          {closedHistory().length > 0 && (
            <Button class="h-6 text-xs" size="sm" variant="tertiary" onPress={() => closedHistory.set([])}>
              Clear
            </Button>
          )}
        </div>
        <div class="min-h-[120px] space-y-2 rounded-lg border border-border bg-surface p-4">
          {closedHistory().length === 0 ? (
            <p class="text-sm text-muted">No toasts closed yet. Try closing one above!</p>
          ) : (
            closedHistory().map((item, index) => (
              <div
                class="flex animate-in items-start justify-between gap-3 rounded-md border border-border bg-default px-3 py-2 text-sm duration-200 fade-in slide-in-from-top-2"
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <div class="flex-1">
                  <span class="font-medium">{item.message}</span>
                  <span class="ms-2 text-xs text-muted">({item.time})</span>
                </div>
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-soft-foreground">
                  <Icon class="size-3" icon={Check} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Toast.Provider />
      <Callbacks />
    </div>
  );
}
