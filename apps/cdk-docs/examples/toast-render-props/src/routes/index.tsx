import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  type QueuedToast,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastList as ToastList,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";

export const head = { title: "Toast render props" };

// #region demo
const queue = new ToastQueue<string>({ maxVisibleToasts: 3 });

export default function Example() {
  const count = signal(0);
  return (
    <>
      {/* Region content other than a render function: your own markup around a ToastList. */}
      <ToastRegion queue={queue} class={({ visibleToasts }) => `rv-ToastRegion count-${visibleToasts().length}`}>
        <h2>Notifications</h2>
        <ToastList>
          {({ toast }: { toast: QueuedToast<string> }) => (
            <Toast toast={toast}>
              {({ isFocusVisible }) => (
                <>
                  <ToastContent>
                    <Text slot="title">{toast.content}</Text>
                    <Text slot="description">{isFocusVisible() ? "(keyboard focus)" : ""}</Text>
                  </ToastContent>
                  <Button slot="close">Close</Button>
                </>
              )}
            </Toast>
          )}
        </ToastList>
      </ToastRegion>
      <Button
        id="trp-add"
        onPress={() => {
          count.set(count() + 1);
          queue.add(`Message ${count()}`);
        }}
      >
        Add message
      </Button>
    </>
  );
}
// #endregion
