// Type-level suite (`tsc -p libs/ui` only): `Toast.Provider` options, custom queues (generic content), `toast()` helpers
// (variants, promise, update, actionProps), render-function children, compound parts; errors: unknown placement / variant.
import { Toast, ToastQueue, toast, toastQueue } from "../src/components/toast/index.ts";
import type { ToastContentValue } from "../src/components/toast/index.ts";

const queue = new ToastQueue({ name: "types", maxVisibleToasts: 2, exitDuration: 200 });
const custom = new ToastQueue<{ name: string }>({ name: "types-custom" });

export const ok = () => (
  <>
    <Toast.Provider placement="top end" gap={8} width="24rem" maxVisibleToasts={5} scaleFactor={0.1} hotkey={["altKey", "KeyN"]} isExpanded />
    <Toast.Provider queue={queue} class="r" />
    <Toast.Provider queue={custom}>
      {({ toast: t, isLoading }) => (
        <Toast toast={t} variant="success" class="t">
          <Toast.Indicator>{isLoading ? "…" : null}</Toast.Indicator>
          <Toast.Content>
            <Toast.Title>{t.content.name}</Toast.Title>
            <Toast.Description>d</Toast.Description>
          </Toast.Content>
          <Toast.ActionButton onPress={() => {}}>Undo</Toast.ActionButton>
          <Toast.CloseButton />
        </Toast>
      )}
    </Toast.Provider>
  </>
);

export const helpers = async () => {
  const key: string = toast("Saved", { description: "d", timeout: 0, onClose: () => {} });
  toast.success("ok");
  toast.danger("no", { actionProps: { children: "Retry", onPress: () => {} } });
  toast.info("i");
  toast.warning("w", { indicator: null });
  toast.update(key, "Updated", { variant: "accent", timeout: 0 });
  const value: ToastContentValue = { title: "t", variant: "accent" };
  void value;
  toast.close(key);
  toast.pauseAll();
  toast.resumeAll();
  toast.clear();
  toast.getQueue().visibleToasts;
  const p = toast.promise(Promise.resolve(1), { loading: "…", success: (n: number) => `got ${n}`, error: (e: Error) => e.message });
  void p;
  toastQueue.add({ title: "x", isLoading: true });
  custom.add({ name: "n" });
  // @ts-expect-error custom queue content shape
  custom.add({ title: "x" });
  // @ts-expect-error unknown variant
  toastQueue.add({ variant: "primary" });
};

// @ts-expect-error unknown placement
export const badPlacement = () => <Toast.Provider placement="middle" />;
