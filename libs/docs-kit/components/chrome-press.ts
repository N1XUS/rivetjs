// Site chrome (RT-DIET2 DOCS-CHROME): a press on a static top-bar button that came before its live cdk trigger, replayed
// on that trigger (`theme-menu-open.tsx`, `mobile-menu-open.tsx`).
/**
 * A click again on `el`: a pointer press when it was one (`detail` > 0: the cdk trigger opens as for that pointer — focus
 * on the selected item), else a virtual click (Enter / Space on the static button).
 */
export function replayPress(el: HTMLElement, click: MouseEvent): void {
  const at = { bubbles: true, cancelable: true, composed: true, clientX: click.clientX, clientY: click.clientY, button: 0 };
  if (click.detail > 0) {
    const pointer = { ...at, pointerId: 1, pointerType: (click as PointerEvent).pointerType || "mouse", isPrimary: true, width: 1, height: 1 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...at, buttons: 1, detail: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", pointer));
    el.dispatchEvent(new MouseEvent("mouseup", { ...at, detail: 1 }));
  }
  el.dispatchEvent(new MouseEvent("click", { ...at, detail: click.detail }));
}
