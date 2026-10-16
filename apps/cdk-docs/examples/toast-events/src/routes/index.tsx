import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";

export const head = { title: "Toast events" };

// #region demo
const queue = new ToastQueue<string>();

export default function Example() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-5), entry]);
  return (
    <>
      <ToastRegion
        queue={queue}
        // Root props land on the region's <div role="region">.
        lang="en-GB"
        data-area="notifications"
        onPointerEnter={() => add("region:enter")}
      >
        {({ toast }) => (
          <Toast toast={toast} lang="nl" onDblClick={() => add("toast:dblclick")}>
            <ToastContent data-part="content">
              <Text slot="title">{toast.content}</Text>
            </ToastContent>
            <Button slot="close" class="close">
              Close
            </Button>
          </Toast>
        )}
      </ToastRegion>
      <Button id="te-add" onPress={() => queue.add("Hallo!", { onClose: () => add("onClose") })}>
        Show toast
      </Button>
      <output id="te-log">{log().join(" ")}</output>
    </>
  );
}
// #endregion
