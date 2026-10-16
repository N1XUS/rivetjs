// Behaviour tests (Chromium, real layout + rAF) for `@rivetjs/cdk/sheet-motion` (Rivet-authored): flick dismiss, slow drag
// settles back, slow drag past the close threshold dismisses, cross-axis moves and scrolled content never start a drag,
// handle-only, snap points (nearest / sequential / snapTo / backdrop fade variable), non-dismissible rubber band, pressed
// target gets pointercancel + the click after a drag is swallowed, reduced motion jumps.
import { afterEach, describe, expect, it } from "vitest";
import { sheetMotion, type SheetMotionController, type SheetMotionOptions, type SheetPlacement } from "../sheet-motion/index.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let controller: SheetMotionController | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
  controller?.destroy();
  controller = undefined;
  host?.remove();
  host = undefined;
});

/** A fixed sheet (`size` px along its axis) + backdrop; returns the sheet and the parts. */
function mount(placement: SheetPlacement, size = 400, inner = "") {
  host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;";
  const vertical = placement === "top" || placement === "bottom";
  const edge = `${placement}:0;` + (vertical ? `left:0;right:0;height:${size}px;` : `top:0;bottom:0;width:${size}px;`);
  host.innerHTML = `<div id="sheet" style="position:fixed;${edge}background:#ddd;">${inner || '<div id="handle" style="height:30px">handle</div><button id="press">press</button>'}</div>`;
  document.body.append(host);
  return { sheet: host.querySelector<HTMLElement>("#sheet")!, backdrop: host };
}

function attach(sheet: HTMLElement, options: Partial<SheetMotionOptions> & { placement: SheetPlacement }) {
  const calls = { close: 0, snaps: [] as number[], releases: [] as boolean[], drags: [] as number[] };
  controller = sheetMotion(sheet, {
    close: () => calls.close++,
    onSnap: (i) => calls.snaps.push(i),
    onRelease: (_e, open) => calls.releases.push(open),
    onDrag: (_e, p) => calls.drags.push(p),
    ...options,
  });
  return calls;
}

const pointer = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "mouse",
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );

/** Drags from (x, y) by (dx, dy) in `steps` moves `delay` ms apart; `pause` ms before releasing. */
async function drag(target: Element, x: number, y: number, dx: number, dy: number, steps: number, delay: number, pause = 0) {
  pointer(target, "pointerdown", x, y);
  for (let i = 1; i <= steps; i++) {
    pointer(window, "pointermove", x + (dx * i) / steps, y + (dy * i) / steps);
    if (delay) await sleep(delay);
  }
  if (pause) await sleep(pause);
  pointer(window, "pointerup", x + dx, y + dy);
}

const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await sleep(16);
  }
};
const translate = (el: HTMLElement) => {
  const m = /translate[XY]\((-?[\d.]+)px\)/.exec(el.style.transform);
  return m ? Number(m[1]) : 0;
};

describe("sheetMotion: dismiss", () => {
  it("flick down dismisses (animates off-screen, then close)", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom" });
    const y = innerHeight - 380;
    await drag(sheet.querySelector("#handle")!, 50, y, 0, 60, 4, 8);
    expect(calls.releases).toEqual([false]);
    expect(calls.close).toBe(0);
    await until(() => calls.close === 1);
    expect(translate(sheet)).toBeGreaterThan(390);
  });

  it("slow short drag settles back open (inline transform cleared)", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom" });
    const y = innerHeight - 380;
    await drag(sheet.querySelector("#handle")!, 50, y, 0, 60, 12, 40, 220);
    expect(calls.releases).toEqual([true]);
    expect(sheet.getAttribute("data-dragging")).toBe("true");
    await until(() => sheet.style.transform === "" && !sheet.hasAttribute("data-dragging"));
    expect(calls.close).toBe(0);
    expect(calls.drags.length).toBeGreaterThan(5);
  });

  it("slow drag past the close threshold dismisses", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom" });
    const y = innerHeight - 380;
    await drag(sheet.querySelector("#handle")!, 50, y, 0, 140, 14, 40, 220);
    await until(() => calls.close === 1);
  });

  it("left / right / top close towards their edge", async () => {
    for (const [placement, dx, dy] of [
      ["left", -80, 0],
      ["right", 80, 0],
      ["top", 0, -80],
    ] as const) {
      const { sheet } = mount(placement, 300);
      const calls = attach(sheet, { placement });
      const box = sheet.getBoundingClientRect();
      await drag(sheet.querySelector("#handle")!, box.left + box.width / 2, box.top + 10, dx, dy, 4, 8);
      await until(() => calls.close === 1);
      expect(Math.abs(translate(sheet))).toBeGreaterThan(290);
      expect(Math.sign(translate(sheet))).toBe(placement === "right" ? 1 : -1);
      controller!.destroy();
      host!.remove();
    }
  });

  it("dragging towards the open side is rubber-banded and settles back", async () => {
    const { sheet } = mount("bottom");
    attach(sheet, { placement: "bottom" });
    const y = innerHeight - 380;
    pointer(sheet, "pointerdown", 50, y);
    for (let i = 1; i <= 10; i++) {
      pointer(window, "pointermove", 50, y - i * 10);
      await sleep(16);
    }
    await sleep(100);
    // 100 px up → 20 px (rubber band 0.2)
    expect(translate(sheet)).toBeLessThan(-10);
    expect(translate(sheet)).toBeGreaterThan(-25);
    pointer(window, "pointerup", 50, y - 100);
    await until(() => sheet.style.transform === "");
  });

  it("overdrag keeps the attached edge covered (bleed with the sheet's background), removed when settled; all placements", async () => {
    for (const placement of ["bottom", "top", "left", "right"] as const) {
      const { sheet } = mount(placement, 300);
      attach(sheet, { placement });
      const vertical = placement === "top" || placement === "bottom";
      const box = sheet.getBoundingClientRect();
      const x = box.left + box.width / 2,
        y = box.top + box.height / 2;
      // Towards the open side: up for a bottom sheet, down for a top sheet, right for a left sheet, left for a right sheet.
      const dir = placement === "bottom" || placement === "right" ? -1 : 1;
      pointer(sheet, "pointerdown", x, y);
      for (let i = 1; i <= 10; i++) {
        pointer(window, "pointermove", vertical ? x : x + dir * i * 15, vertical ? y + dir * i * 15 : y);
        await sleep(16);
      }
      await sleep(60);
      expect(Math.abs(translate(sheet))).toBeGreaterThan(10);
      const bleed = sheet.querySelector<HTMLElement>("[data-sheet-bleed]");
      expect(bleed).not.toBeNull();
      expect(getComputedStyle(bleed!).backgroundColor).toBe(getComputedStyle(sheet).backgroundColor);
      // The sheet + bleed reach the attached viewport edge (no gap).
      const b = bleed!.getBoundingClientRect(),
        s = sheet.getBoundingClientRect();
      if (placement === "bottom") expect([Math.abs(b.top - s.bottom) < 1, b.bottom >= innerHeight]).toEqual([true, true]);
      if (placement === "top") expect([Math.abs(s.top - b.bottom) < 1, b.top <= 0]).toEqual([true, true]);
      if (placement === "right") expect([Math.abs(b.left - s.right) < 1, b.right >= innerWidth]).toEqual([true, true]);
      if (placement === "left") expect([Math.abs(s.left - b.right) < 1, b.left <= 0]).toEqual([true, true]);
      pointer(window, "pointerup", vertical ? x : x + dir * 150, vertical ? y + dir * 150 : y);
      await until(() => sheet.style.transform === "" && !sheet.querySelector("[data-sheet-bleed]"));
      controller!.destroy();
      host!.remove();
    }
  });

  it("bleed: false never adds the bleed", async () => {
    const { sheet } = mount("bottom");
    attach(sheet, { placement: "bottom", bleed: false });
    const y = innerHeight - 380;
    pointer(sheet, "pointerdown", 50, y);
    for (let i = 1; i <= 10; i++) {
      pointer(window, "pointermove", 50, y - i * 10);
      await sleep(16);
    }
    expect(translate(sheet)).toBeLessThan(-10);
    expect(sheet.querySelector("[data-sheet-bleed]")).toBeNull();
    pointer(window, "pointerup", 50, y - 100);
    await until(() => sheet.style.transform === "");
  });

  it("non-dismissible: a flick never closes", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom", dismissible: false });
    await drag(sheet, 50, innerHeight - 380, 0, 120, 4, 8);
    await until(() => sheet.style.transform === "");
    expect(calls.close).toBe(0);
  });
});

describe("sheetMotion: gestures that are not drags", () => {
  it("cross-axis moves never drag (vertical on a side sheet, sideways on a bottom sheet)", async () => {
    const { sheet } = mount("right", 300);
    const calls = attach(sheet, { placement: "right" });
    const box = sheet.getBoundingClientRect();
    await drag(sheet, box.left + 100, 200, 4, 120, 6, 8);
    await sleep(60);
    expect(sheet.style.transform).toBe("");
    expect(calls.drags).toEqual([]);
    controller!.destroy();
    host!.remove();
    const bottom = mount("bottom").sheet;
    const calls2 = attach(bottom, { placement: "bottom" });
    await drag(bottom, 100, innerHeight - 300, 120, 4, 6, 8);
    await sleep(60);
    expect(bottom.style.transform).toBe("");
    expect(calls2.drags).toEqual([]);
  });

  it("vertical scroll is not hijacked: a scrolled container scrolls first; wheel scrolls", async () => {
    const { sheet } = mount("bottom", 400, `<div id="scroller" style="height:300px;overflow-y:auto"><div style="height:2000px">tall</div></div>`);
    const calls = attach(sheet, { placement: "bottom" });
    const scroller = sheet.querySelector<HTMLElement>("#scroller")!;
    scroller.scrollTop = 200;
    const y = innerHeight - 300;
    await drag(scroller.firstElementChild!, 50, y, 0, 120, 6, 8);
    await sleep(60);
    expect(sheet.style.transform).toBe("");
    expect(calls.drags).toEqual([]);
    // Fully expanded, dragging up inside a scrollable container scrolls it (no rubber band).
    await drag(scroller.firstElementChild!, 50, y, 0, -120, 6, 8);
    await sleep(60);
    expect(sheet.style.transform).toBe("");
    // At the top, dragging down moves the sheet.
    scroller.scrollTop = 0;
    await drag(scroller.firstElementChild!, 50, y, 0, 80, 4, 8);
    await until(() => calls.close === 1);
  });

  it("text fields never start a drag", async () => {
    const { sheet } = mount("bottom", 400, `<input id="field" style="height:40px">`);
    const calls = attach(sheet, { placement: "bottom" });
    await drag(sheet.querySelector("#field")!, 50, innerHeight - 380, 0, 120, 4, 8);
    await sleep(60);
    expect(calls.drags).toEqual([]);
  });

  it("handle-only: drags start on the handle only", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom", handle: "#handle" });
    await drag(sheet.querySelector("#press")!, 20, innerHeight - 360, 0, 120, 4, 8);
    await sleep(60);
    expect(calls.drags).toEqual([]);
    await drag(sheet.querySelector("#handle")!, 50, innerHeight - 390, 0, 120, 4, 8);
    await until(() => calls.close === 1);
  });

  it("a drag cancels the press under the pointer and swallows the following click", async () => {
    const { sheet } = mount("bottom");
    attach(sheet, { placement: "bottom", dismissible: false });
    const button = sheet.querySelector<HTMLButtonElement>("#press")!;
    let cancels = 0,
      clicks = 0;
    button.addEventListener("pointercancel", () => cancels++);
    button.addEventListener("click", () => clicks++);
    const box = button.getBoundingClientRect();
    await drag(button, box.left + 5, box.top + 5, 0, 40, 4, 8);
    button.click();
    expect(cancels).toBe(1);
    expect(clicks).toBe(0);
    await sleep(20);
    button.click();
    expect(clicks).toBe(1);
  });
});

describe("sheetMotion: snap points", () => {
  it("rests at the active point, releases to the nearest, writes the backdrop fade variable", async () => {
    const { sheet, backdrop } = mount("bottom", 600);
    const calls = attach(sheet, { placement: "bottom", snapPoints: ["200px", "400px", 1], activeSnapIndex: 0, backdrop });
    // 600 px sheet, 200 px visible → offset 400
    expect(translate(sheet)).toBe(400);
    expect(sheet.style.getPropertyValue("--snap-point-height")).toBe("400px");
    expect(backdrop.style.getPropertyValue("--sheet-backdrop-opacity")).toBe("0");
    const top = () => sheet.getBoundingClientRect().top;
    // Slow drag up 190 px → nearest is the 400 px point (offset 200).
    await drag(sheet, 50, top() + 10, 0, -190, 19, 30, 220);
    expect(calls.snaps).toEqual([1]);
    await until(() => Math.abs(translate(sheet) - 200) < 0.5 && !sheet.hasAttribute("data-dragging"));
    controller!.snapTo(2);
    await until(() => backdrop.style.getPropertyValue("--sheet-backdrop-opacity") === "1");
    expect(Math.abs(translate(sheet))).toBeLessThan(0.01);
    controller!.snapTo(0, true);
    expect(translate(sheet)).toBe(400);
  });

  it("sequential: a flick moves one point only; dismiss only from the lowest point", async () => {
    const { sheet } = mount("bottom", 600);
    const calls = attach(sheet, { placement: "bottom", snapPoints: ["200px", "400px", 1], activeSnapIndex: 2, sequential: true });
    expect(translate(sheet)).toBe(0);
    const top = () => sheet.getBoundingClientRect().top;
    await drag(sheet, 50, top() + 10, 0, 80, 4, 8);
    expect(calls.snaps).toEqual([1]);
    expect(calls.close).toBe(0);
    await until(() => Math.abs(translate(sheet) - 200) < 0.5 && !sheet.hasAttribute("data-dragging"));
    await drag(sheet, 50, top() + 10, 0, 80, 4, 8);
    expect(calls.snaps).toEqual([1, 0]);
    await until(() => Math.abs(translate(sheet) - 400) < 0.5 && !sheet.hasAttribute("data-dragging"));
    await drag(sheet, 50, top() + 10, 0, 80, 4, 8);
    await until(() => calls.close === 1);
  });

  it("not sequential: a strong flick from the top point can close", async () => {
    const { sheet } = mount("bottom", 600);
    const calls = attach(sheet, { placement: "bottom", snapPoints: ["200px", 1], activeSnapIndex: 1 });
    await drag(sheet, 50, sheet.getBoundingClientRect().top + 10, 0, 200, 4, 6);
    await until(() => calls.close === 1);
  });
});

describe("sheetMotion: reduced motion", () => {
  it("releases jump", async () => {
    const { sheet } = mount("bottom");
    const calls = attach(sheet, { placement: "bottom", reduceMotion: () => true });
    await drag(sheet, 50, innerHeight - 380, 0, 60, 4, 8);
    // Jumps: closed on the next frame, no animation to the edge.
    await sleep(50);
    expect(calls.close).toBe(1);
  });
});
