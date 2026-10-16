// Ported from @radix-ui/react-scroll-area src/scroll-area.test.tsx (radix-ui/primitives main @ 1.3.0, MIT, © 2022 WorkOS).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium, real layout); `screen.getByTestId` → `querySelector`;
// `className` → `class`; refs are Rivet `RefValue`s (`{ current }`); `asChild` cases → the cdk `render` prop (spread the
// received attributes onto an `<article>`); jest-dom matchers from `@rivetjs/testing/jest-dom`.
// - "ref stability" (React 19 composed-ref churn, radix-ui/primitives#3963): a ref callback is called once with the element.
// - Corner cases: Chromium lays the scrollbars out (`style` sizes), so no `assignScrollbarsSizes` stub.
// - Skipped: "falls back to the content wrapper when `asChild` children are not a single element" (`asChild` / Slot
//   fallback + dev warning; `render` has no single-child requirement).
// Rivet additions (Chromium behaviour): thumb size / position from scroll metrics, thumb drag, track click, wheel on a
// scrollbar, `hover` / `scroll` / `auto` visibility timing (fake `setTimeout`), RTL, resize, corner sizes, exit animation.
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Dir } from "../bidi/bidi-dir.tsx";
import * as ScrollArea from "../scroll-area/index.tsx";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
// Captured before a test installs fake timers.
const realTimeout = globalThis.setTimeout.bind(globalThis);
const sleep = (ms: number) => new Promise((resolve) => realTimeout(resolve, ms));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function until(check: () => boolean, timeout = 2000): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error("until: timed out");
    await sleep(5);
  }
}

// Synthetic pointer events have no active pointer: pointer capture would throw.
let captureSpies: ReturnType<typeof vi.spyOn>[] = [];
beforeAll(() => {
  captureSpies = [
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {}),
    vi.spyOn(Element.prototype, "releasePointerCapture").mockImplementation(() => {}),
    vi.spyOn(Element.prototype, "hasPointerCapture").mockImplementation(() => true),
  ];
});
afterAll(() => captureSpies.forEach((spy) => spy.mockRestore()));

const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));

describe("ScrollArea ref stability", () => {
  it("keeps a stable composed ref on the root", async () => {
    const ref = vi.fn();
    render(() => (
      <ScrollArea.Root ref={ref}>
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    await flush();
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref.mock.calls[0]![0]).toBeInstanceOf(HTMLDivElement);
  });

  it("keeps a stable composed ref on the scrollbar", async () => {
    const ref = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" ref={ref}>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    await flush();
    await flush();
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref.mock.calls[0]![0]).toHaveAttribute("data-orientation", "vertical");
  });
});

describe("ScrollArea.Root", () => {
  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always" ref={ref} data-testid="root" class="custom-class" style={{ outlineColor: "rgb(1, 2, 3)" }} onClick={onClick}>
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const root = byTestId("root");
    expect(root).toHaveClass("custom-class");
    expect(root.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(root);
    root.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root
        type="always"
        ref={ref}
        data-testid="root"
        class="custom-class"
        style={{ outlineColor: "rgb(1, 2, 3)" }}
        onClick={onClick}
        render={(props) => <article {...(props as {})} />}
      >
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const root = byTestId("root");
    expect(root.tagName).toBe("ARTICLE");
    expect(root.style.position).toBe("relative");
    expect(root).toHaveClass("custom-class");
    expect(root.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(root);
    root.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ScrollArea.Scrollbar", () => {
  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          ref={ref}
          data-testid="scrollbar"
          class="custom-class"
          style={{ outlineColor: "rgb(1, 2, 3)" }}
          onClick={onClick}
        />
      </ScrollArea.Root>
    ));
    await flush();
    const scrollbar = byTestId("scrollbar");
    expect(scrollbar).toHaveClass("custom-class");
    expect(scrollbar.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(scrollbar);
    scrollbar.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          ref={ref}
          data-testid="scrollbar"
          class="custom-class"
          style={{ outlineColor: "rgb(1, 2, 3)" }}
          onClick={onClick}
          render={(props) => <article {...(props as {})} />}
        />
      </ScrollArea.Root>
    ));
    await flush();
    const scrollbar = byTestId("scrollbar");
    expect(scrollbar.tagName).toBe("ARTICLE");
    expect(scrollbar).toHaveAttribute("data-orientation", "vertical");
    expect(scrollbar).toHaveAttribute("data-state", "visible");
    expect(scrollbar).toHaveClass("custom-class");
    expect(scrollbar.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(scrollbar);
    scrollbar.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ScrollArea.Thumb", () => {
  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          {/* `forceMount` because the thumb otherwise waits for a measured overflow */}
          <ScrollArea.Thumb forceMount ref={ref} data-testid="thumb" class="custom-class" style={{ outlineColor: "rgb(1, 2, 3)" }} onClick={onClick} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    await flush();
    const thumb = byTestId("thumb");
    expect(thumb).toHaveClass("custom-class");
    expect(thumb.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(thumb);
    thumb.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb
            forceMount
            ref={ref}
            data-testid="thumb"
            class="custom-class"
            style={{ outlineColor: "rgb(1, 2, 3)" }}
            onClick={onClick}
            render={(props) => <article {...(props as {})} />}
          />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    await flush();
    const thumb = byTestId("thumb");
    expect(thumb.tagName).toBe("ARTICLE");
    expect(thumb).toHaveAttribute("data-state", "hidden");
    expect(thumb).toHaveClass("custom-class");
    expect(thumb.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(thumb);
    thumb.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ScrollArea.Corner", () => {
  const scrollbarStyle = { width: "16px", height: "16px" };

  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" style={scrollbarStyle} />
        <ScrollArea.Scrollbar orientation="vertical" style={scrollbarStyle} />
        <ScrollArea.Corner ref={ref} data-testid="corner" class="custom-class" style={{ outlineColor: "rgb(1, 2, 3)" }} onClick={onClick} />
      </ScrollArea.Root>
    ));
    await until(() => !!byTestId("corner"));
    const corner = byTestId("corner");
    expect(corner).toHaveClass("custom-class");
    expect(corner.style.outlineColor).toBe("rgb(1, 2, 3)");
    await until(() => ref.current === corner);
    corner.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" style={scrollbarStyle} />
        <ScrollArea.Scrollbar orientation="vertical" style={scrollbarStyle} />
        <ScrollArea.Corner
          ref={ref}
          data-testid="corner"
          class="custom-class"
          style={{ outlineColor: "rgb(1, 2, 3)" }}
          onClick={onClick}
          render={(props) => <article {...(props as {})} />}
        />
      </ScrollArea.Root>
    ));
    await until(() => !!byTestId("corner"));
    const corner = byTestId("corner");
    expect(corner.tagName).toBe("ARTICLE");
    expect(corner.style.position).toBe("absolute");
    expect(corner.style.width).toBe("16px");
    expect(corner).toHaveClass("custom-class");
    expect(corner.style.outlineColor).toBe("rgb(1, 2, 3)");
    await until(() => ref.current === corner);
    corner.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ScrollArea.Viewport", () => {
  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport ref={ref} data-testid="viewport" class="custom-class" style={{ outlineColor: "rgb(1, 2, 3)" }} onClick={onClick}>
          Content
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const viewport = byTestId("viewport");
    expect(viewport).toHaveClass("custom-class");
    expect(viewport.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(viewport);
    viewport.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport
          ref={ref}
          data-testid="viewport"
          class="custom-class"
          style={{ outlineColor: "rgb(1, 2, 3)" }}
          onClick={onClick}
          render={(props) => <article {...(props as {})} />}
        >
          Content
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const viewport = byTestId("viewport");
    expect(viewport.tagName).toBe("ARTICLE");
    expect(viewport).toHaveAttribute("data-rv-scroll-area-viewport", "");
    expect(viewport.style.overflowX).toBe("hidden");
    expect(viewport.style.overflowY).toBe("hidden");
    expect(viewport).toHaveClass("custom-class");
    expect(viewport.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(viewport);
    expect(viewport.firstElementChild).toHaveStyle({ display: "table", minWidth: "100%" });
    expect(viewport).toHaveTextContent("Content");
    viewport.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("renders an implicit content element around its children by default", () => {
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport data-testid="viewport">Content</ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    const viewport = byTestId("viewport");
    const content = viewport.firstElementChild;
    expect(content).toBeInstanceOf(HTMLDivElement);
    expect(content).toHaveStyle({ display: "table", minWidth: "100%" });
    expect(content).toHaveTextContent("Content");
  });

  it("skips the implicit content element when `disableImplicitContentElement` is set", () => {
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement data-testid="viewport">
          <span data-testid="child">Content</span>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    const viewport = byTestId("viewport");
    const child = byTestId("child");
    expect(viewport.firstElementChild).toBe(child);
    expect(child).not.toHaveStyle({ display: "table" });
  });

  it("forwards props to the rendered element when `render` is set with `disableImplicitContentElement`", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport
          disableImplicitContentElement
          ref={ref}
          data-testid="viewport"
          class="custom-class"
          style={{ outlineColor: "rgb(1, 2, 3)" }}
          onClick={onClick}
          render={(props) => <article {...(props as {})} />}
        >
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const viewport = byTestId("viewport");
    expect(viewport.tagName).toBe("ARTICLE");
    expect(viewport).toHaveAttribute("data-rv-scroll-area-viewport", "");
    expect(viewport.style.overflowX).toBe("hidden");
    expect(viewport.style.overflowY).toBe("hidden");
    expect(viewport).toHaveClass("custom-class");
    expect(viewport.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(viewport);
    expect(viewport.firstElementChild).toHaveStyle({ display: "table", minWidth: "100%" });
    expect(viewport).toHaveTextContent("Content");
    viewport.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ScrollArea.Content", () => {
  it("spreads props it does not consume onto the element it renders", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content ref={ref} data-testid="content" class="custom-class" style={{ outlineColor: "rgb(1, 2, 3)" }} onClick={onClick}>
            Content
          </ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const content = byTestId("content");
    expect(content).toHaveStyle({ display: "table", minWidth: "100%" });
    expect(content).toHaveClass("custom-class");
    expect(content.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(content);
    content.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("forwards props to the rendered element when `render` is set (Radix `asChild`)", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(() => (
      <ScrollArea.Root type="always">
        <ScrollArea.Viewport disableImplicitContentElement>
          <ScrollArea.Content
            ref={ref}
            data-testid="content"
            class="custom-class"
            style={{ outlineColor: "rgb(1, 2, 3)" }}
            onClick={onClick}
            render={(props) => <article {...(props as {})} />}
          >
            Content
          </ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await flush();
    const content = byTestId("content");
    expect(content.tagName).toBe("ARTICLE");
    expect(content).toHaveStyle({ display: "table", minWidth: "100%" });
    expect(content).toHaveClass("custom-class");
    expect(content.style.outlineColor).toBe("rgb(1, 2, 3)");
    expect(ref.current).toBe(content);
    expect(content).toHaveTextContent("Content");
    content.click();
    expect(onClick).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Rivet: behaviour in a real layout. 200 × 200 viewport, 1000 × 1000 content, 10 px scrollbars.
// ---------------------------------------------------------------------------------------------------------------

interface DemoOptions {
  type?: ScrollArea.ScrollAreaType;
  dir?: "ltr" | "rtl";
  scrollHideDelay?: number;
  horizontal?: boolean;
  corner?: boolean;
  contentHeight?: () => number;
  padding?: number;
}

function Demo(props: DemoOptions) {
  const padding = props.padding ? props.padding + "px" : undefined;
  const barY = { width: "10px", padding, boxSizing: "border-box" as const };
  const barX = { height: "10px", padding, boxSizing: "border-box" as const };
  return (
    <ScrollArea.Root
      type={props.type ?? "always"}
      dir={props.dir}
      scrollHideDelay={props.scrollHideDelay}
      data-testid="root"
      style={{ width: "200px", height: "200px" }}
    >
      <ScrollArea.Viewport data-testid="viewport" style={{ width: "100%", height: "100%" }}>
        <div data-testid="inner" style={{ width: "1000px", height: (props.contentHeight?.() ?? 1000) + "px" }} />
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-y" style={barY}>
        <ScrollArea.Thumb data-testid="thumb-y" />
      </ScrollArea.Scrollbar>
      {props.horizontal ? (
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-x" style={barX}>
          <ScrollArea.Thumb data-testid="thumb-x" />
        </ScrollArea.Scrollbar>
      ) : null}
      {props.corner ? <ScrollArea.Corner data-testid="corner" /> : null}
    </ScrollArea.Root>
  );
}

const translateY = (el: HTMLElement) => Number(/translate3d\(0(?:px)?, (-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? NaN);
const translateX = (el: HTMLElement) => Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? NaN);

describe("ScrollArea behaviour (Rivet, Chromium)", () => {
  it("enables native scrolling on the axes that have a scrollbar", async () => {
    render(() => <Demo />);
    const viewport = byTestId("viewport");
    await until(() => viewport.style.overflowY === "scroll");
    expect(viewport.style.overflowX).toBe("hidden");
  });

  it("sizes the thumb from the viewport / content ratio and moves it with the scroll position", async () => {
    render(() => <Demo />);
    await until(() => !!byTestId("thumb-y"));
    const thumb = byTestId("thumb-y");
    const scrollbar = byTestId("scrollbar-y");
    expect(scrollbar.style.getPropertyValue("--rv-scroll-area-thumb-height")).toBe("40px");
    expect(thumb.getBoundingClientRect().height).toBe(40);
    expect(thumb).toHaveAttribute("data-state", "visible");
    expect(translateY(thumb)).toBe(0);
    const viewport = byTestId("viewport");
    viewport.scrollTop = 400;
    // (400 / 800) × (200 − 40)
    await until(() => translateY(thumb) === 80);
    viewport.scrollTop = 800;
    await until(() => translateY(thumb) === 160);
  });

  it("subtracts the scrollbar padding and keeps an 18 px minimum thumb", async () => {
    const height = signal(1000);
    render(() => <Demo padding={2} contentHeight={() => height()} />);
    await until(() => !!byTestId("thumb-y"));
    const scrollbar = byTestId("scrollbar-y");
    // (200 − 4) × 0.2
    expect(scrollbar.style.getPropertyValue("--rv-scroll-area-thumb-height")).toBe(`${196 * 0.2}px`);
    height.set(100000);
    await until(() => scrollbar.style.getPropertyValue("--rv-scroll-area-thumb-height") === "18px");
  });

  it("re-measures when the content resizes; no thumb once nothing overflows", async () => {
    const height = signal(1000);
    render(() => <Demo contentHeight={() => height()} />);
    await until(() => !!byTestId("thumb-y"));
    const scrollbar = byTestId("scrollbar-y");
    height.set(400);
    await until(() => scrollbar.style.getPropertyValue("--rv-scroll-area-thumb-height") === "100px");
    height.set(150);
    await until(() => !byTestId("thumb-y"));
    height.set(1000);
    await until(() => !!byTestId("thumb-y"));
  });

  it("drags the thumb: the grabbed point follows the pointer", async () => {
    render(() => <Demo />);
    await until(() => !!byTestId("thumb-y"));
    const thumb = byTestId("thumb-y");
    const scrollbar = byTestId("scrollbar-y");
    const viewport = byTestId("viewport");
    const top = scrollbar.getBoundingClientRect().top;
    pointer("pointerdown", thumb, { clientY: top + 10 });
    // grabbed 10 px into the thumb: pointer range [10, 170] → scroll [0, 800]
    expect(viewport.scrollTop).toBe(0);
    expect(document.body.style.webkitUserSelect).toBe("none");
    expect(viewport.style.scrollBehavior).toBe("auto");
    pointer("pointermove", thumb, { clientY: top + 90 });
    expect(viewport.scrollTop).toBe(400);
    pointer("pointermove", thumb, { clientY: top + 500 });
    expect(viewport.scrollTop).toBe(800);
    pointer("pointerup", thumb, { clientY: top + 500 });
    expect(document.body.style.webkitUserSelect).toBe("");
    expect(viewport.style.scrollBehavior).toBe("");
    // no drag after the pointer is released
    pointer("pointermove", thumb, { clientY: top + 20 });
    expect(viewport.scrollTop).toBe(800);
  });

  it("clicking the track scrolls so the thumb centre lands on the pointer", async () => {
    render(() => <Demo />);
    await until(() => !!byTestId("thumb-y"));
    const scrollbar = byTestId("scrollbar-y");
    const viewport = byTestId("viewport");
    const top = scrollbar.getBoundingClientRect().top;
    // centre offset 20: pointer range [20, 180] → scroll [0, 800]
    pointer("pointerdown", scrollbar, { clientY: top + 100 });
    expect(viewport.scrollTop).toBe(400);
    pointer("pointerup", scrollbar, { clientY: top + 100 });
    // secondary button: nothing
    pointer("pointerdown", scrollbar, { clientY: top + 180, button: 2 });
    expect(viewport.scrollTop).toBe(400);
  });

  it("wheel over a scrollbar scrolls the viewport and stops the page scroll inside the bounds", async () => {
    render(() => <Demo />);
    await until(() => !!byTestId("thumb-y"));
    const scrollbar = byTestId("scrollbar-y");
    const viewport = byTestId("viewport");
    const wheel = (deltaY: number) => scrollbar.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
    expect(wheel(100)).toBe(false);
    expect(viewport.scrollTop).toBe(100);
    // past the end: the page may scroll
    expect(wheel(1000)).toBe(true);
    expect(viewport.scrollTop).toBe(800);
  });

  it("RTL: the horizontal thumb runs from the right (negative scrollLeft / offsets) and the vertical scrollbar sits left", async () => {
    render(() => <Demo dir="rtl" horizontal />);
    await until(() => !!byTestId("thumb-x"));
    const root = byTestId("root");
    expect(root).toHaveAttribute("dir", "rtl");
    const scrollbarY = byTestId("scrollbar-y");
    expect(scrollbarY.style.left).toBe("0px");
    expect(scrollbarY.style.right).toBe("");
    const scrollbarX = byTestId("scrollbar-x");
    expect(scrollbarX.style.left).toBe("var(--rv-scroll-area-corner-width)");
    expect(scrollbarX.style.right).toBe("0px");
    const thumb = byTestId("thumb-x");
    const viewport = byTestId("viewport");
    // the thumb starts at the right edge (rtl block) and moves left: offsets in [-160, 0]
    expect(translateX(thumb)).toBe(0);
    expect(thumb.getBoundingClientRect().right).toBe(scrollbarX.getBoundingClientRect().right);
    viewport.scrollLeft = -800;
    await until(() => translateX(thumb) === -160);
    const top = scrollbarX.getBoundingClientRect();
    pointer("pointerdown", scrollbarX, { clientX: top.left + 100 });
    expect(viewport.scrollLeft).toBe(-400);
    pointer("pointerup", scrollbarX);
  });

  it("inherits the direction of a `<Dir>` ancestor", () => {
    render(() => (
      <Dir dir="rtl">
        <Demo />
      </Dir>
    ));
    expect(byTestId("root")).toHaveAttribute("dir", "rtl");
  });

  it("corner: sized from the scrollbars, exposed as CSS variables, reset when it unmounts", async () => {
    const shown = signal(true);
    render(() => (
      <ScrollArea.Root type="always" data-testid="root" style={{ width: "200px", height: "200px" }}>
        <ScrollArea.Viewport style={{ width: "100%", height: "100%" }}>
          <div style={{ width: "1000px", height: "1000px" }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: "12px" }} data-testid="scrollbar-y" />
        <Show when={shown}>{() => <ScrollArea.Scrollbar orientation="horizontal" style={{ height: "8px" }} />}</Show>
        <ScrollArea.Corner data-testid="corner" />
      </ScrollArea.Root>
    ));
    await until(() => !!byTestId("corner"));
    const root = byTestId("root");
    const corner = byTestId("corner");
    expect(corner.style.width).toBe("12px");
    expect(corner.style.height).toBe("8px");
    expect(corner.style.right).toBe("0px");
    expect(corner.style.bottom).toBe("0px");
    expect(root.style.getPropertyValue("--rv-scroll-area-corner-width")).toBe("12px");
    expect(root.style.getPropertyValue("--rv-scroll-area-corner-height")).toBe("8px");
    expect(byTestId("scrollbar-y").getBoundingClientRect().height).toBe(192);
    shown.set(false);
    await until(() => !byTestId("corner"));
    await until(() => root.style.getPropertyValue("--rv-scroll-area-corner-height") === "0px");
    expect(root.style.getPropertyValue("--rv-scroll-area-corner-width")).toBe("0px");
    expect(byTestId("scrollbar-y").getBoundingClientRect().height).toBe(200);
  });

  it('type="scroll": no corner', async () => {
    render(() => <Demo type="scroll" horizontal corner />);
    const viewport = byTestId("viewport");
    await until(() => viewport.style.overflowY === "scroll");
    viewport.scrollTop = 10;
    viewport.scrollLeft = 10;
    await until(() => !!byTestId("scrollbar-x") && !!byTestId("scrollbar-y"));
    await sleep(50);
    expect(byTestId("corner")).toBeNull();
  });

  it('type="auto": a scrollbar only on an overflowing axis', async () => {
    const height = signal(150);
    render(() => (
      <ScrollArea.Root type="auto" style={{ width: "200px", height: "200px" }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: "100%", height: "100%" }}>
          <div style={{ width: "1000px", height: height() + "px" }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-y" style={{ width: "10px" }} />
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-x" style={{ height: "10px" }} />
      </ScrollArea.Root>
    ));
    await until(() => !!byTestId("scrollbar-x"));
    expect(byTestId("scrollbar-x")).toHaveAttribute("data-state", "visible");
    await sleep(50);
    expect(byTestId("scrollbar-y")).toBeNull();
    height.set(1000);
    await until(() => !!byTestId("scrollbar-y"));
    height.set(150);
    await until(() => !byTestId("scrollbar-y"));
  });

  it('type="hover": shown on pointerenter, hidden `scrollHideDelay` ms after pointerleave', async () => {
    render(() => <Demo type="hover" scrollHideDelay={300} />);
    const root = byTestId("root");
    await flush();
    expect(byTestId("scrollbar-y")).toBeNull();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    root.dispatchEvent(new PointerEvent("pointerenter"));
    await flush();
    // the overflow check (ResizeObserver → rAF → 10 ms debounce) runs inside
    await until(() => {
      vi.advanceTimersByTime(10);
      return !!byTestId("scrollbar-y");
    });
    expect(byTestId("scrollbar-y")).toHaveAttribute("data-state", "visible");
    root.dispatchEvent(new PointerEvent("pointerleave"));
    vi.advanceTimersByTime(299);
    await flush();
    expect(byTestId("scrollbar-y")).not.toBeNull();
    // re-entering cancels the hide
    root.dispatchEvent(new PointerEvent("pointerenter"));
    vi.advanceTimersByTime(300);
    await flush();
    expect(byTestId("scrollbar-y")).not.toBeNull();
    root.dispatchEvent(new PointerEvent("pointerleave"));
    vi.advanceTimersByTime(300);
    await flush();
    await until(() => !byTestId("scrollbar-y"));
  });

  it('type="scroll": visible while scrolling, hidden `scrollHideDelay` ms after the scroll ends; interacting keeps it', async () => {
    render(() => <Demo type="scroll" scrollHideDelay={200} />);
    const viewport = byTestId("viewport");
    await until(() => viewport.style.overflowY === "scroll");
    expect(byTestId("scrollbar-y")).toBeNull();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    viewport.scrollTop = 50;
    await until(() => !!byTestId("scrollbar-y"));
    const scrollbar = byTestId("scrollbar-y");
    expect(scrollbar).toHaveAttribute("data-state", "visible");
    // scrolling → idle after 100 ms without scroll events, hidden scrollHideDelay later
    vi.advanceTimersByTime(100);
    await flush();
    vi.advanceTimersByTime(199);
    await flush();
    expect(byTestId("scrollbar-y")).not.toBeNull();
    // pointer over the scrollbar: interacting (no hide)
    pointer("pointerenter", byTestId("scrollbar-y"), { bubbles: false });
    await flush();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(byTestId("scrollbar-y")).not.toBeNull();
    pointer("pointerleave", byTestId("scrollbar-y"), { bubbles: false });
    await flush();
    vi.advanceTimersByTime(200);
    await flush();
    await until(() => !byTestId("scrollbar-y"));
  });

  it("forceMount keeps a hidden scrollbar mounted with data-state=hidden", async () => {
    render(() => (
      <ScrollArea.Root type="scroll" style={{ width: "200px", height: "200px" }}>
        <ScrollArea.Viewport style={{ width: "100%", height: "100%" }}>
          <div style={{ height: "1000px" }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" forceMount data-testid="scrollbar-y" />
      </ScrollArea.Root>
    ));
    expect(byTestId("scrollbar-y")).toHaveAttribute("data-state", "hidden");
  });

  it("keeps a scrollbar with an exit animation mounted until the animation ends", async () => {
    const style = document.head.appendChild(document.createElement("style"));
    style.textContent = `@keyframes rv-test-fade-out { from { opacity: 1 } to { opacity: 0 } } [data-testid="scrollbar-y"][data-state="hidden"] { animation: rv-test-fade-out 150ms }`;
    try {
      render(() => <Demo type="hover" scrollHideDelay={0} />);
      const root = byTestId("root");
      await flush();
      root.dispatchEvent(new PointerEvent("pointerenter"));
      await until(() => !!byTestId("scrollbar-y"));
      await frame();
      root.dispatchEvent(new PointerEvent("pointerleave"));
      await until(() => byTestId("scrollbar-y")?.getAttribute("data-state") === "hidden");
      await frame();
      expect(byTestId("scrollbar-y")).not.toBeNull();
      await until(() => !byTestId("scrollbar-y"), 1000);
    } finally {
      style.remove();
    }
  });
});
