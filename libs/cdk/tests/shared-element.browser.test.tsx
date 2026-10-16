// SharedElementTransition / SharedElement / SelectionIndicator in real Chromium (client-rendered).
// Upstream (react-spectrum) has no test suite for these components; the cases follow
// packages/react-aria-components/src/SharedElementTransition.tsx behaviour branch by branch.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { SharedElement, SharedElementTransition } from "../shared-element-transition/index.tsx";
import { SelectionIndicator } from "../selection-indicator/index.tsx";
import { Tabs, type Key } from "../tabs/index.tsx";
import { RadioGroup } from "../radio-group/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";

const CSS = `
.slot { position: relative; width: 100px; height: 20px; }
.row { display: flex; gap: 100px; }
.wide { width: 160px; }
.se { position: absolute; left: 0; top: 0; width: 100%; height: 3px; background: teal; transition: translate 200ms, width 200ms; }
.se-none { transition: none; }
.fade { transition: opacity 120ms; }
.fade[data-exiting] { opacity: 0; }
[role=tab], .rv-Radio, .rv-ToggleButton { position: relative; }
[role=tablist] { display: flex; gap: 40px; }
.rv-SelectionIndicator { position: absolute; left: 0; bottom: 0; width: 100%; height: 3px; transition: translate 200ms, width 200ms; }
`;

let style: HTMLStyleElement | undefined;
function css() {
  style ??= document.head.appendChild(Object.assign(document.createElement("style"), { textContent: CSS }));
}
afterEach(() => cleanup());

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Two slots (A at x=0, 100px wide; B at x=200, 160px wide), each with a SharedElement named "x". */
function twoSlots(className = "se") {
  css();
  const selected = signal<"a" | "b" | null>("a");
  const { container } = render(() => (
    <SharedElementTransition>
      <div class="row">
        <div class="slot" id="a">
          <SharedElement name="x" class={className} isVisible={() => selected() === "a"} />
        </div>
        <div class="slot wide" id="b">
          <SharedElement name="x" class={className} isVisible={() => selected() === "b"} />
        </div>
      </div>
    </SharedElementTransition>
  ));
  const el = (slot: string) => container.querySelector<HTMLElement>(`#${slot} > div`);
  return { selected, el };
}

describe("SharedElement", () => {
  it("throws outside a SharedElementTransition", () => {
    expect(() => render(() => <SharedElement name="x" />)).toThrow("<SharedElement> must be rendered inside a <SharedElementTransition>");
  });

  it("mount without a snapshot: data-entering for one frame", async () => {
    const { el } = twoSlots();
    expect(el("a")).not.toBeNull();
    expect(el("b")).toBeNull();
    await microtasks();
    expect(el("a")!.getAttribute("data-entering")).toBe("true");
    await frame();
    expect(el("a")!.hasAttribute("data-entering")).toBe(false);
  });

  it("moves: snapshot on hide, the new instance starts at the old rect delta and the old width, overrides cleared next frame, transitions run", async () => {
    const { selected, el } = twoSlots();
    await microtasks();
    await frame();
    const from = el("a")!.getBoundingClientRect();
    selected.set("b");
    // Synchronously after the change the old element is still there (it snapshots first).
    expect(el("a")).not.toBeNull();
    await microtasks();
    const b = el("b")!;
    const to = b.parentElement!.getBoundingClientRect();
    expect(el("a"), "the consumed snapshot unmounts the old instance").toBeNull();
    expect(b.hasAttribute("data-entering")).toBe(false);
    expect(parseFloat(b.style.translate)).toBeCloseTo(from.left - to.left, 0);
    expect(b.style.width).toBe(`${from.width}px`);
    expect(b.getAnimations().length, "writes made before the frame trigger no transition").toBe(0);
    await frame();
    expect(b.style.translate).toBe("");
    expect(b.style.width).toBe("");
    const running = b
      .getAnimations()
      .map((a) => (a as CSSTransition).transitionProperty)
      .sort();
    expect(running).toEqual(["translate", "width"]);
    await wait(260);
    expect(b.getBoundingClientRect().left).toBeCloseTo(to.left, 0);
  });

  it("transition-property none: no snapshot, the next instance enters", async () => {
    const { selected, el } = twoSlots("se se-none");
    await microtasks();
    await frame();
    selected.set("b");
    await microtasks();
    expect(el("a")).toBeNull();
    expect(el("b")!.style.translate).toBe("");
    expect(el("b")!.getAttribute("data-entering")).toBe("true");
  });

  it("hidden with no new instance: data-exiting until its animations finish, then unmounted", async () => {
    const { selected, el } = twoSlots("se fade");
    await microtasks();
    await frame();
    selected.set(null);
    await microtasks();
    expect(el("a")!.getAttribute("data-exiting")).toBe("true");
    expect(el("a")!.getAnimations().length).toBeGreaterThan(0);
    await wait(250);
    expect(el("a")).toBeNull();
    expect(el("b")).toBeNull();
  });

  it("render props: class and children functions see isEntering / isExiting", async () => {
    css();
    render(() => (
      <SharedElementTransition>
        <SharedElement name="y" id="rp" class={({ isEntering }) => (isEntering() ? "in" : "settled")}>
          {({ isEntering }) => <span>{isEntering() ? "entering" : "visible"}</span>}
        </SharedElement>
      </SharedElementTransition>
    ));
    const rp = document.getElementById("rp")!;
    expect(rp.className).toBe("settled");
    await microtasks();
    expect(rp.className).toBe("in");
    expect(rp.textContent).toBe("entering");
    await frame();
    expect(rp.className).toBe("settled");
    expect(rp.textContent).toBe("visible");
  });
});

const holders = (selector: string) =>
  [...document.querySelectorAll(selector)]
    .filter((el) => el.querySelector(".rv-SelectionIndicator"))
    .map((el) => el.getAttribute("data-key") ?? el.textContent!.trim());

describe("SelectionIndicator", () => {
  it("follows Tabs selection (click + keyboard), moving with a translate", async () => {
    css();
    const selected = signal<Key | null>("one");
    render(() => (
      <Tabs
        id="t"
        aria-label="T"
        selectedKey={selected}
        items={[
          { id: "one", label: "One" },
          { id: "two", label: "Two two two" },
          { id: "three", label: "Three" },
        ]}
        tab={(item) => (
          <>
            {item.label}
            <SelectionIndicator />
          </>
        )}
      />
    ));
    await microtasks();
    await frame();
    expect(holders("#t [role=tab]")).toEqual(["one"]);
    const tab = (key: string) => document.getElementById(`t-tab-${key}`)!;
    tab("two").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, isPrimary: true }));
    tab("two").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0, isPrimary: true }));
    tab("two").click();
    expect(selected()).toBe("two");
    await microtasks();
    expect(holders("#t [role=tab]")).toEqual(["two"]);
    const moved = tab("two").querySelector<HTMLElement>(".rv-SelectionIndicator")!;
    expect(parseFloat(moved.style.translate)).toBeCloseTo(tab("one").getBoundingClientRect().left - tab("two").getBoundingClientRect().left, 0);
    tab("two").focus();
    tab("two").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(selected()).toBe("three");
    await microtasks();
    expect(holders("#t [role=tab]")).toEqual(["three"]);
  });

  it("follows RadioGroup selection", async () => {
    css();
    render(() => (
      <RadioGroup
        id="r"
        aria-label="Size"
        orientation="horizontal"
        defaultValue="s"
        items={[
          { value: "s", label: "Small" },
          { value: "l", label: "Large" },
        ]}
      >
        {(item) => (
          <>
            {item().label}
            <SelectionIndicator />
          </>
        )}
      </RadioGroup>
    ));
    expect(holders("#r .rv-Radio")).toEqual(["Small"]);
    document.querySelector<HTMLInputElement>("#r input[value=l]")!.click();
    await microtasks();
    expect(holders("#r .rv-Radio")).toEqual(["Large"]);
  });

  it("follows ToggleButton selection inside a SharedElementTransition", async () => {
    css();
    const on = signal(false);
    render(() => (
      <SharedElementTransition>
        <ToggleButton id="tb" isSelected={on}>
          Bold
          <SelectionIndicator />
        </ToggleButton>
      </SharedElementTransition>
    ));
    const button = document.getElementById("tb")!;
    expect(button.querySelector(".rv-SelectionIndicator")).toBeNull();
    on.set(true);
    await microtasks();
    expect(button.querySelector(".rv-SelectionIndicator")!.getAttribute("data-entering")).toBe("true");
  });
});
