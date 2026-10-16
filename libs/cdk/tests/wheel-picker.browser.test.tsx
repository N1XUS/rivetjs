// Behaviour tests (Chromium, real layout + rAF) for the Rivet-authored `@rivetjs/cdk/wheel-picker` drums and
// `@rivetjs/cdk/time-wheels` (TimeField binding): spinbutton a11y, keyboard steps / wrap (59 → 00) / ends / Home / End /
// type-ahead, disabled options skipped, wheel notches + trackpad snap, drag + flick momentum (settles on an item), tap
// to an item, reduced motion jumps, segments ⇄ drums sync both ways, min / max, 12 / 24 h locales, granularity second,
// minute step, RTL group order.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { DateInput, DateSegment, TimeField } from "../date-field/index.tsx";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import { TimeWheels } from "../time-wheels/index.tsx";
import { createWheelState, Wheel, wheelOffset, type WheelOption } from "../wheel-picker/index.tsx";

afterEach(cleanup);

const CSS = ".rv-Wheel{height:180px;width:60px}.rv-WheelItem{height:36px;line-height:36px;text-align:center}";
let style: HTMLStyleElement | undefined;
function mount(ui: () => unknown): HTMLElement {
  if (!style) {
    style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
  }
  return render(ui as never).container as HTMLElement;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await sleep(16);
  }
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const pointer = (target: EventTarget, type: string, y: number, pointerType = "mouse") =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 3,
      pointerType,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: 30,
      clientY: y,
    }),
  );
const settled = (el: Element) => !el.hasAttribute("data-moving");
const center = (el: Element) => el.querySelector("[data-selected]")?.textContent;

const minutes = (): WheelOption<number>[] => Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));

describe("wheelOffset", () => {
  it("is the shortest way round on looped drums", () => {
    expect(wheelOffset(0, 59, 60, true)).toBe(1);
    expect(wheelOffset(59, 0, 60, true)).toBe(-1);
    expect(wheelOffset(30, 0, 60, true)).toBe(-30);
    expect(wheelOffset(5, 2.5, 60, true)).toBe(2.5);
    expect(wheelOffset(0, 59, 60, false)).toBe(-59);
  });
});

describe("Wheel", () => {
  it("is a spinbutton with value / text / range and positions items around the centre", () => {
    const c = mount(() => <Wheel options={minutes()} defaultValue={7} loop aria-label="Minute" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    expect(el.getAttribute("aria-valuenow")).toBe("7");
    expect(el.getAttribute("aria-valuetext")).toBe("07");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("59");
    expect(el.getAttribute("tabindex")).toBe("0");
    expect(el.style.touchAction).toBe("none");
    expect(center(el)).toBe("07");
    const items = el.querySelectorAll<HTMLElement>("[data-rv-wheel-item]");
    expect(items.length).toBe(60);
    expect(items[7]!.style.getPropertyValue("--rv-wheel-offset")).toBe("0");
    expect(items[8]!.style.getPropertyValue("--rv-wheel-offset")).toBe("1");
    // Looped: 59 sits above 00 when 00 is near the centre.
    expect(items[0]!.getBoundingClientRect().top).toBeLessThan(items[7]!.getBoundingClientRect().top);
    expect(items[30]!.style.visibility).toBe("hidden");
    const mid = el.getBoundingClientRect().top + el.offsetHeight / 2;
    const r = items[7]!.getBoundingClientRect();
    expect(Math.abs(r.top + r.height / 2 - mid)).toBeLessThan(1);
  });

  it("keyboard: arrows step, wrap 59 → 00 when looped, PageUp / PageDown, Home / End", async () => {
    const value = signal<number | null>(58);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="Minute" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    key(el, "ArrowUp");
    expect(value()).toBe(59);
    key(el, "ArrowUp");
    expect(value()).toBe(0);
    key(el, "ArrowDown");
    expect(value()).toBe(59);
    key(el, "PageUp");
    expect(value()).toBe(4);
    key(el, "PageDown");
    expect(value()).toBe(59);
    key(el, "Home");
    expect(value()).toBe(0);
    key(el, "End");
    expect(value()).toBe(59);
    await until(() => settled(el));
    expect(center(el)).toBe("59");
    expect(el.getAttribute("aria-valuenow")).toBe("59");
  });

  it("non-looped drums stop at the ends", () => {
    const value = signal<number | null>(1);
    const c = mount(() => <Wheel options={minutes().slice(0, 3)} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    key(el, "ArrowUp");
    key(el, "ArrowUp");
    expect(value()).toBe(2);
    key(el, "Home");
    key(el, "ArrowDown");
    expect(value()).toBe(0);
  });

  it("type-ahead: digits select numeric values, then the label prefix", () => {
    const value = signal<number | null>(0);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="Minute" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    key(el, "4");
    expect(value()).toBe(4);
    key(el, "5");
    expect(value()).toBe(45);
    key(el, "9");
    expect(value()).toBe(9);
  });

  it("disabled options are skipped and marked", () => {
    const value = signal<number | null>(1);
    const c = mount(() => <Wheel options={minutes()} value={value} loop isOptionDisabled={(v: number) => v >= 2 && v <= 4} aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    expect(el.querySelector("[data-index='3']")!.getAttribute("data-disabled")).toBe("true");
    key(el, "ArrowUp");
    expect(value()).toBe(5);
    key(el, "ArrowDown");
    expect(value()).toBe(1);
    // "3" is disabled: the first enabled label starting with "3".
    key(el, "3");
    expect(value()).toBe(30);
  });

  it("disabled drum ignores input and is not focusable", () => {
    const value = signal<number | null>(1);
    const c = mount(() => <Wheel options={minutes()} value={value} isDisabled aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.getAttribute("aria-disabled")).toBe("true");
    key(el, "ArrowUp");
    expect(value()).toBe(1);
  });

  it("wheel: a notch steps one item; trackpad deltas spin and snap after they stop", async () => {
    const value = signal<number | null>(10);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    // The non-passive wheel listener is installed by the mount effect (resumed pages: first pointer over).
    await flush();
    const notch = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    el.dispatchEvent(notch);
    expect(notch.defaultPrevented).toBe(true);
    expect(value()).toBe(11);
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
    expect(value()).toBe(10);
    await until(() => settled(el));
    for (let i = 0; i < 10; i++) {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: 9, bubbles: true, cancelable: true }));
      await sleep(16);
    }
    expect(value()).toBe(10);
    await until(() => value() !== 10, 1000);
    // 90 px of 36 px items ≈ 2.5 → snaps to 12 or 13 and rests on the item.
    expect([12, 13]).toContain(value());
    await until(() => settled(el));
    expect(center(el)).toBe(String(value()).padStart(2, "0"));
    expect((el.querySelector(`[data-index='${value()}']`) as HTMLElement).style.getPropertyValue("--rv-wheel-offset")).toBe("0");
  });

  it("drag follows the pointer; a slow release settles on the nearest item", async () => {
    const value = signal<number | null>(20);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    const y = el.getBoundingClientRect().top + 90;
    pointer(el, "pointerdown", y);
    for (let i = 1; i <= 10; i++) {
      pointer(window, "pointermove", y - i * 8);
      await sleep(16);
    }
    expect(el.getAttribute("data-dragging")).toBe("true");
    await sleep(250);
    pointer(window, "pointerup", y - 80);
    // 80 px up ≈ 2.2 items → 22.
    expect(value()).toBe(22);
    await until(() => settled(el));
    expect(el.hasAttribute("data-dragging")).toBe(false);
    expect(center(el)).toBe("22");
  });

  it("a flick throws further than the drag (momentum) and still lands on an item", async () => {
    const value = signal<number | null>(0);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    const y = el.getBoundingClientRect().top + 90;
    pointer(el, "pointerdown", y);
    for (let i = 1; i <= 4; i++) {
      pointer(window, "pointermove", y - i * 15);
      await sleep(8);
    }
    pointer(window, "pointerup", y - 60);
    // Dragged 60 px (≈ 1.7 items); the flick projects several items further.
    expect(value()!).toBeGreaterThan(4);
    await until(() => settled(el), 4000);
    expect(el.getAttribute("aria-valuenow")).toBe(String(value()));
    expect(center(el)).toBe(String(value()).padStart(2, "0"));
  });

  it("tap on an item spins to it", async () => {
    const value = signal<number | null>(10);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    const item = el.querySelector("[data-index='12']") as HTMLElement;
    const r = item.getBoundingClientRect();
    pointer(item, "pointerdown", r.top + 5);
    pointer(window, "pointerup", r.top + 5);
    expect(value()).toBe(12);
    expect(document.activeElement).toBe(el);
    await until(() => settled(el));
  });

  it("reduced motion: steps jump (no motion frames)", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
    try {
      const value = signal<number | null>(10);
      const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
      const el = c.querySelector("[role=spinbutton]") as HTMLElement;
      key(el, "ArrowUp");
      expect(value()).toBe(11);
      expect(el.hasAttribute("data-moving")).toBe(false);
      expect(center(el)).toBe("11");
    } finally {
      window.matchMedia = original;
    }
  });

  it("follows an outside value change (spins to it)", async () => {
    const value = signal<number | null>(10);
    const c = mount(() => <Wheel options={minutes()} value={value} loop aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    await flush();
    value.set(15);
    await flush();
    expect(el.getAttribute("data-moving")).toBe("true");
    await until(() => settled(el));
    expect(center(el)).toBe("15");
  });

  it("shared state: createWheelState + Wheel", () => {
    const state = createWheelState({ options: minutes(), defaultValue: 3 });
    const c = mount(() => <Wheel state={state} aria-label="m" />);
    const el = c.querySelector("[role=spinbutton]") as HTMLElement;
    key(el, "ArrowUp");
    expect(state.selected.value()).toBe(4);
  });
});

/** A TimeField with segments + drums (drums in the field, as a popover would put them). */
function timeField(props: Record<string, unknown>, wheels: Record<string, unknown> = {}, locale = "en-US") {
  return mount(() => (
    <I18nProvider locale={locale}>
      <TimeField aria-label="Time" {...props}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
        <TimeWheels {...wheels} />
      </TimeField>
    </I18nProvider>
  ));
}
const drum = (c: HTMLElement, type: string) => c.querySelector(`.rv-Wheel[data-type=${type}]`) as HTMLElement;
const segment = (c: HTMLElement, type: string) => c.querySelector(`.rv-DateSegment[data-type=${type}]`) as HTMLElement;

describe("TimeWheels", () => {
  it("en-US: hour / minute / AM-PM drums in segment order, values from the field", () => {
    const c = timeField({ defaultValue: "09:45:00" });
    const types = [...c.querySelectorAll(".rv-Wheel")].map((w) => w.getAttribute("data-type"));
    expect(types).toEqual(["hour", "minute", "dayPeriod"]);
    expect(drum(c, "hour").getAttribute("aria-valuenow")).toBe("9");
    expect(drum(c, "hour").getAttribute("aria-label")).toBe("hour");
    expect(drum(c, "minute").getAttribute("aria-valuetext")).toBe("45");
    expect(drum(c, "dayPeriod").getAttribute("aria-valuetext")).toBe("AM");
    expect(drum(c, "hour").querySelectorAll("[data-rv-wheel-item]")[0]!.textContent).toBe("12");
    expect(c.querySelector(".rv-TimeWheels")!.getAttribute("role")).toBe("group");
  });

  it("drum → segments: spinning the minute wraps 59 → 00 and the segment follows", () => {
    const value = signal<string | null>("10:59:00");
    const c = timeField({ value });
    key(drum(c, "minute"), "ArrowUp");
    expect(value()).toBe("10:00:00");
    expect(segment(c, "minute").textContent).toBe("00");
    key(drum(c, "dayPeriod"), "ArrowUp");
    expect(value()).toBe("22:00:00");
    expect(segment(c, "dayPeriod").textContent).toBe("PM");
  });

  it("segments → drum: typing into a segment spins the drum", async () => {
    const c = timeField({ defaultValue: "10:15:00" });
    await flush();
    key(segment(c, "minute"), "ArrowUp");
    expect(segment(c, "minute").textContent).toBe("16");
    expect(drum(c, "minute").getAttribute("aria-valuenow")).toBe("16");
    await until(() => settled(drum(c, "minute")));
    expect(center(drum(c, "minute"))).toBe("16");
  });

  it("an empty field: the first spin completes it from the placeholder", () => {
    const value = signal<string | null>(null);
    const c = timeField({ value });
    expect(drum(c, "hour").getAttribute("aria-valuenow")).toBe("12");
    key(drum(c, "hour"), "ArrowUp");
    expect(value()).toBe("01:00:00");
  });

  it("24 h locale (de-DE): hour + minute drums, 0 … 23 (digits as the field formats them)", () => {
    const value = signal<string | null>("23:30:00");
    const c = timeField({ value }, {}, "de-DE");
    expect([...c.querySelectorAll(".rv-Wheel")].map((w) => w.getAttribute("data-type"))).toEqual(["hour", "minute"]);
    const items = drum(c, "hour").querySelectorAll("[data-rv-wheel-item]");
    expect(items.length).toBe(24);
    expect(items[0]!.textContent).toBe("0");
    expect(items[23]!.textContent).toBe("23");
    key(drum(c, "hour"), "ArrowUp");
    expect(value()).toBe("00:30:00");
  });

  it("granularity second + minute step", () => {
    const c = timeField({ defaultValue: "08:07:30", granularity: "second" }, { minuteStep: 5 });
    expect([...c.querySelectorAll(".rv-Wheel")].map((w) => w.getAttribute("data-type"))).toEqual(["hour", "minute", "second", "dayPeriod"]);
    expect(drum(c, "minute").querySelectorAll("[data-rv-wheel-item]").length).toBe(12);
    expect(drum(c, "minute").getAttribute("aria-valuenow")).toBe("5");
    expect(drum(c, "second").getAttribute("aria-valuenow")).toBe("30");
  });

  it("min / max: out-of-range options are disabled and skipped; a change clamps", () => {
    const value = signal<string | null>("09:30:00");
    const c = timeField({ value, minValue: "09:15:00", maxValue: "17:00:00" }, {}, "de-DE");
    const hour = drum(c, "hour");
    expect(hour.querySelector("[data-index='8']")!.getAttribute("data-disabled")).toBe("true");
    expect(hour.querySelector("[data-index='9']")!.hasAttribute("data-disabled")).toBe(false);
    expect(hour.querySelector("[data-index='18']")!.getAttribute("data-disabled")).toBe("true");
    expect(drum(c, "minute").querySelector("[data-index='10']")!.getAttribute("data-disabled")).toBe("true");
    key(hour, "ArrowDown");
    // 08 is disabled: skipped backwards through the loop to 17 (17:30 clamps to 17:00).
    expect(value()).toBe("17:00:00");
    key(hour, "Home");
    expect(value()).toBe("09:15:00");
  });

  it("RTL locale: the group is rtl, numeric drums sit in an LTR run", () => {
    const c = timeField({ defaultValue: "09:45:00" }, {}, "ar-EG");
    const group = c.querySelector(".rv-TimeWheels") as HTMLElement;
    expect(group.getAttribute("dir")).toBe("rtl");
    const run = group.querySelector(".rv-TimeWheels-run") as HTMLElement;
    expect(run.style.direction).toBe("ltr");
    const [h, m] = [drum(c, "hour"), drum(c, "minute")];
    expect(h.getBoundingClientRect().left).toBeLessThan(m.getBoundingClientRect().left);
    // Arabic-Indic digits, AM/PM drum present (ar-EG is 12 h).
    expect(drum(c, "minute").getAttribute("aria-valuetext")).toBe("٤٥");
    expect(drum(c, "dayPeriod")).not.toBeNull();
  });

  it("autoFocus focuses the first drum on mount (not when disabled)", async () => {
    const c = timeField({ defaultValue: "09:45:00" }, { autoFocus: true });
    await flush();
    expect(document.activeElement).toBe(drum(c, "hour"));
    const d = timeField({ defaultValue: "09:45:00", isDisabled: true }, { autoFocus: true });
    await flush();
    expect(document.activeElement).not.toBe(drum(d, "hour"));
  });

  it("disabled / read-only field: drums do not change it", () => {
    const value = signal<string | null>("10:00:00");
    const c = timeField({ value, isReadOnly: true });
    key(drum(c, "minute"), "ArrowUp");
    expect(value()).toBe("10:00:00");
    expect(drum(c, "minute").getAttribute("aria-readonly")).toBe("true");
  });
});
