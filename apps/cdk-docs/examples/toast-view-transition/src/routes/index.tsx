import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";

export const head = { title: "Toast view transitions" };

// #region demo
const queue = new ToastQueue<string>({
  maxVisibleToasts: 5,
  // Every queue update ("add" | "remove" | "clear") runs inside a view transition when supported.
  wrapUpdate(fn) {
    const doc = globalThis.document;
    if (doc && "startViewTransition" in doc) doc.startViewTransition(fn);
    else fn();
  },
});

export default function Example() {
  return (
    <>
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast} style={{ viewTransitionName: toast.key }}>
            <ToastContent>
              <Text slot="title">{toast.content}</Text>
            </ToastContent>
            <Button slot="close" class="close">
              Close
            </Button>
          </Toast>
        )}
      </ToastRegion>
      <Button id="tvt-add" onPress={() => queue.add("Animated toast")}>
        Show toast
      </Button>
    </>
  );
}
// #endregion
