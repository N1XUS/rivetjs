// resizePreviewMode="separator": the preview of a separator follows the pointer (react-resizable-panels
// ResizePreview). Rivet: an offset-only change moves the existing preview node (no re-render / clone per move).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Group, Panel, Separator } from "../resizable/index.tsx";

afterEach(() => cleanup());

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const byId = (id: string) => document.getElementById(id) as HTMLElement;
const pointer = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1 }));

describe("resize preview", () => {
  it("moves the existing preview node while dragging (offset-only changes)", async () => {
    let previewRenders = 0;
    render(() => (
      <div style={{ width: "1000px", height: "200px" }}>
        <Group id="g" resizePreviewMode="separator">
          <Panel id="a" defaultSize="30%" />
          <Separator id="s1" preview={() => (previewRenders++, <div class="line" />)} />
          <Panel id="b" defaultSize="40%" />
          <Separator id="s2" />
          <Panel id="c" />
        </Group>
      </div>
    ));
    await frame();
    await frame();
    const sep = byId("s1");
    const r = sep.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    pointer(sep, "pointerdown", x, y);
    pointer(document, "pointermove", x + 10, y);
    await frame();
    const first = document.querySelector<HTMLElement>("[data-resize-preview]");
    expect(first).not.toBeNull();
    const renders = previewRenders;
    const transform = first!.style.transform;
    for (let i = 2; i < 8; i++) {
      pointer(document, "pointermove", x + 10 * i, y);
      await frame();
    }
    const now = document.querySelector<HTMLElement>("[data-resize-preview]");
    expect(now).toBe(first);
    expect(now!.style.transform).not.toBe(transform);
    expect(previewRenders).toBe(renders);
    pointer(document, "pointerup", x + 70, y);
    await frame();
    expect(document.querySelector("[data-resize-preview]")).toBeNull();
  });
});
