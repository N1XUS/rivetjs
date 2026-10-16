import { CircleAlert, CircleCheck, X } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "@rivetjs/cdk/toast";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Toast with Tailwind" };

// #region demo
interface Note {
  variant: "success" | "error";
  title: string;
}

const notes = new ToastQueue<Note>({ maxVisibleToasts: 4 });

export default function Example() {
  return (
    <div class="flex gap-2 p-6">
      <ToastRegion
        queue={notes}
        class="fixed right-4 bottom-4 flex flex-col-reverse gap-2 rounded-lg outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-blue-500 data-[focus-visible]:ring-offset-4"
      >
        {({ toast }) => (
          <Toast
            toast={toast}
            data-variant={toast.content.variant}
            class="flex w-72 items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-blue-300 data-[variant=error]:bg-red-700 data-[variant=success]:bg-emerald-700"
          >
            <Icon icon={toast.content.variant === "success" ? CircleCheck : CircleAlert} size={18} />
            <ToastContent class="flex-1">
              <Text slot="title" class="font-semibold">
                {toast.content.title}
              </Text>
            </ToastContent>
            <Button slot="close" class="rounded p-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-white data-[hovered]:bg-white/20">
              <Icon icon={X} />
            </Button>
          </Toast>
        )}
      </ToastRegion>
      <Button id="tw-success" class="rounded border border-slate-300 px-3 py-1.5" onPress={() => notes.add({ variant: "success", title: "Saved" })}>
        Success
      </Button>
      <Button id="tw-error" class="rounded border border-slate-300 px-3 py-1.5" onPress={() => notes.add({ variant: "error", title: "Upload failed" })}>
        Error
      </Button>
    </div>
  );
}
// #endregion
