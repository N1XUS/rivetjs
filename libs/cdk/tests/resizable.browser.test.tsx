import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Group, Panel, Separator } from "../resizable/index.tsx";

afterEach(() => cleanup());

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const byId = (id: string) => document.getElementById(id) as HTMLElement;
const key = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

describe("smoke", () => {
  it("mounts and resizes with the keyboard", async () => {
    let last: Record<string, number> | undefined;
    render(() => (
      <div style={{ width: "1000px", height: "200px" }}>
        <Group id="g" onLayoutChange={(layout) => (last = layout)}>
          <Panel id="a" defaultSize="30%" />
          <Separator id="s" />
          <Panel id="b" />
        </Group>
      </div>
    ));
    await frame();
    await frame();
    expect(last).toEqual({ a: 30, b: 70 });
    expect(byId("a").style.flexGrow).toBe("30");
    const sep = byId("s");
    expect(sep.getAttribute("aria-valuenow")).toBe("30");
    sep.focus();
    key(sep, "ArrowRight");
    expect(last).toEqual({ a: 35, b: 65 });
    await frame();
    expect(byId("a").style.flexGrow).toBe("35");
    expect(sep.getAttribute("data-separator")).toBe("focus");
  });
});
