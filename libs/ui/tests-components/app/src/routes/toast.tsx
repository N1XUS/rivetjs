// Toast on a resumed page (upstream toast.browser.test.tsx fixture + stacking / keyboard cases): the default `<Toast.Provider />`
// (shared `toastQueue`) and a second provider on a module-level `ToastQueue({ name: "ui-stories" })` placed top end. The server
// renders only the region anchors; the first toast wakes a region. `#t-add` persistent toast, `#t-success` success toast with
// description + action (`#t-state` counts action presses), `#t-promise` promise toast (resolves after 300 ms), `#t-custom`
// persistent toast on the custom queue, `#t-clear` clears both queues.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Toast, ToastQueue, toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast" };

// Module-level: the resumed page and the server share no queue instance; the browser module owns it.
const custom = new ToastQueue({ name: "ui-stories" });

export default function ToastStories() {
  const pressed = signal(0);
  return (
    <section class="flex flex-wrap gap-4 p-10">
      <span id="t-state">{pressed()}</span>
      <Toast.Provider />
      <Toast.Provider queue={custom} placement="top end" />
      <Button id="t-add" onPress={() => toast("Saved", { description: "Done", timeout: 0 })}>
        Show toast
      </Button>
      <Button
        id="t-success"
        onPress={() =>
          toast.success("Uploaded", {
            description: "3 files",
            timeout: 0,
            actionProps: { children: "Undo", onPress: () => pressed.set(pressed() + 1) },
          })
        }
      >
        Success
      </Button>
      <Button
        id="t-promise"
        onPress={() =>
          toast.promise(new Promise<string>((resolve) => setTimeout(() => resolve("report.pdf"), 300)), {
            loading: "Generating",
            success: (name: string) => `Created ${name}`,
            error: "Failed",
          })
        }
      >
        Promise
      </Button>
      <Button id="t-custom" onPress={() => custom.add({ title: "Custom queue" }, { timeout: 0 })}>
        Custom
      </Button>
      <Button
        id="t-clear"
        onPress={() => {
          toast.clear();
          custom.clear();
        }}
      >
        Clear
      </Button>
    </section>
  );
}
