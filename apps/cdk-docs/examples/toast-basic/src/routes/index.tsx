import { X } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Toast" };

// #region demo
interface MyToast {
  title: string;
  description: string;
}

// One queue for the app, created at module level. The server renders no region:
// on the resumed page the first `add` wakes the <ToastRegion> below.
const toasts = new ToastQueue<MyToast>({ maxVisibleToasts: 5 });

export default function Example() {
  return (
    <>
      <ToastRegion queue={toasts}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{toast.content.title}</Text>
              <Text slot="description">{toast.content.description}</Text>
            </ToastContent>
            <Button slot="close" class="close">
              <Icon icon={X} />
            </Button>
          </Toast>
        )}
      </ToastRegion>
      <Button id="tb-add" onPress={() => toasts.add({ title: "Files uploaded", description: "3 files uploaded successfully." })}>
        Show toast
      </Button>
    </>
  );
}
// #endregion
