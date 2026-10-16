import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";

export const head = { title: "Toast" };

// Module-level queue: the server renders no region; on the resumed page the first `add` wakes the region.
const queue = new ToastQueue<{ title: string; description: string }>({ name: "stories", maxVisibleToasts: 5 });

export default function ToastStory() {
  return (
    <section>
      <h1>Toast</h1>
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast} class="toast">
            <ToastContent>
              <Text slot="title">{toast.content.title}</Text>
              <Text slot="description">{toast.content.description}</Text>
            </ToastContent>
            <Button slot="close" class="close">
              Close
            </Button>
          </Toast>
        )}
      </ToastRegion>
      <Button id="add" onPress={() => queue.add({ title: "Saved", description: "Your changes were saved." })}>
        Show toast
      </Button>
      <Button id="add-timed" onPress={() => queue.add({ title: "Timed", description: "Goes away." }, { timeout: 5000 })}>
        Show timed toast
      </Button>
    </section>
  );
}
