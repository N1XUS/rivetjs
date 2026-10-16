import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { CdkTrapFocus } from "@rivetjs/cdk/a11y/focus-trap";

export function Panel(props: { onClose: () => void }) {
  const panel = ref<HTMLDivElement>();
  // ngAfterContentInit → attach(); ngOnDestroy → destroy().
  clientEffect(() => {
    const element = panel();
    if (!element) return;
    const trap = new CdkTrapFocus(element, { autoCapture: true });
    trap.attach();
    return () => trap.destroy();
  });
  const onClose = props.onClose;
  return (
    <div ref={panel} class="grid gap-2 rounded-md border border-teal-700 p-3">
      <input id="name" aria-label="Name" class="rounded border border-slate-300 px-2 py-1" />
      <button id="close" type="button" class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={() => onClose()}>
        Close
      </button>
    </div>
  );
}
