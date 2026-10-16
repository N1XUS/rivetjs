import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";

export const head = { title: "Toast timeout" };

// #region demo
const queue = new ToastQueue<string>({ maxVisibleToasts: 3 });

export default function Example() {
  // The key `add` returns, kept in a signal so the resumed handler can read it.
  const key = signal<string | null>(null);
  const log = signal<string[]>([]);
  return (
    <>
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{toast.content}</Text>
            </ToastContent>
            <Button slot="close">Dismiss</Button>
          </Toast>
        )}
      </ToastRegion>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          id="tt-toggle"
          onPress={() => {
            const current = key();
            if (current) {
              queue.close(current);
            } else {
              key.set(queue.add("Sticky", { onClose: () => (key.set(null), log.update((l) => [...l, "closed: Sticky"])) }));
            }
          }}
        >
          {key() ? "Hide toast" : "Show toast"}
        </Button>
        <Button id="tt-timed" onPress={() => queue.add("Timed", { timeout: 3000, onClose: () => log.update((l) => [...l, "closed: Timed"]) })}>
          Show timed toast (3 s)
        </Button>
      </div>
      <output id="tt-log">{log().join(", ")}</output>
    </>
  );
}
// #endregion
