// A DOM-only "framework" for the driver's browser tests (framework-free): a component attaches to its server HTML
// (hydrate) or writes it (mount), renders props into it on `update`, appends client slot nodes into its holes, and
// logs every adapter call.
import type { ClientAdapter } from "../adapter.ts";

export interface FakeHandle {
  root: Element;
  props: Record<string, unknown>;
  update(props: Record<string, unknown>): void;
  destroy(): void;
}
export interface FakeClientComponent {
  /** `fresh`: mount (write the markup); else hydrate (attach to the existing markup; may throw = mismatch). */
  attach(root: Element, props: Record<string, unknown>, slots: Record<string, Node[] | null>, fresh: boolean): FakeHandle;
}

/** Adapter calls of the current test: `hydrate i0 {props}`, `mount`, `update`, `unmount`. */
export const log: { call: string; id?: string; props?: Record<string, unknown>; slots?: Record<string, Node[] | null>; handle?: unknown }[] = [];
export const fakeClient: ClientAdapter<FakeClientComponent, FakeHandle> = {
  hydrate(root, component, props, slots, ctx) {
    log.push({ call: "hydrate", id: ctx.id, props: { ...props }, slots });
    return component.attach(root, props, slots, false);
  },
  mount(root, component, props, slots, ctx) {
    log.push({ call: "mount", id: ctx.id, props: { ...props }, slots });
    return component.attach(root, props, slots, true);
  },
  update(handle, props) {
    log.push({ call: "update", props: { ...props }, handle });
    handle.update(props);
  },
  unmount(handle) {
    log.push({ call: "unmount", handle });
    handle.destroy();
  },
};

/** Clicks the fake framework's own button handler saw (replay checks). */
export const clicks: { n: number; pointerdowns: number } = { n: 0, pointerdowns: 0 };

/** `<div class="counter"><span>{count}</span><button>+</button><rivet-slot …>{children}</rivet-slot></div>`. */
export const Counter: FakeClientComponent = {
  attach(root, props, slots, fresh) {
    if (fresh) {
      root.innerHTML = '<div class="counter"><span></span><button>+</button><rivet-slot style="display:contents"></rivet-slot></div>';
      root.querySelector(":scope > div > rivet-slot")!.append(...(slots.default ?? []));
    }
    const span = root.querySelector(":scope > div > span");
    const button = root.querySelector(":scope > div > button");
    if (!span || !button) throw new Error("hydration mismatch");
    if (!fresh && span.textContent !== String(props.count)) throw new Error("hydration mismatch: " + span.textContent + " vs " + String(props.count));
    span.textContent = String(props.count);
    let current = props;
    const onClick = () => {
      clicks.n++;
      (current.onIncrement as ((n: number) => unknown) | undefined)?.(clicks.n);
    };
    const onDown = () => clicks.pointerdowns++;
    button.addEventListener("click", onClick);
    button.addEventListener("pointerdown", onDown);
    const handle: FakeHandle = {
      root,
      props,
      update(next) {
        current = handle.props = next;
        span.textContent = String(next.count);
      },
      destroy() {
        button.removeEventListener("click", onClick);
        button.removeEventListener("pointerdown", onDown);
      },
    };
    return handle;
  },
};

/** What `Stopper`'s handlers saw: target tag, `checked`, `defaultPrevented`, modifier keys. */
export const seen: { tag: string; checked?: boolean; prevented: boolean; ctrl: boolean; shift: boolean; button: number }[] = [];

/**
 * `<div class="stop"><input type="checkbox"><a href="#moved">go</a></div>` (also radios, submit buttons): click handlers
 * on every input / link / button that stop propagation (a framework handler the window-level replay guard must still cover).
 */
export const Stopper: FakeClientComponent = {
  attach(root, props) {
    const targets = [...root.querySelectorAll("input, a, button")];
    const onClick = (event: Event) => {
      const mouse = event as MouseEvent;
      const el = event.currentTarget as HTMLInputElement;
      seen.push({
        tag: el.tagName,
        checked: el.tagName === "INPUT" ? el.checked : undefined,
        prevented: event.defaultPrevented,
        ctrl: mouse.ctrlKey,
        shift: mouse.shiftKey,
        button: mouse.button,
      });
      event.stopPropagation();
    };
    for (const el of targets) el.addEventListener("click", onClick);
    const handle: FakeHandle = {
      root,
      props,
      update(next) {
        handle.props = next;
      },
      destroy() {
        for (const el of targets) el.removeEventListener("click", onClick);
      },
    };
    return handle;
  },
};

/** Always mismatches on hydrate; mounts like `Counter`. */
export const Mismatch: FakeClientComponent = {
  attach(root, props, slots, fresh) {
    if (!fresh) throw new Error("mismatch");
    return Counter.attach(root, props, slots, true);
  },
};

/** Server HTML of a `Counter` island (what `_island` server writes), slot content inside the hole. */
export const counterHtml = (id: string, count: unknown, slot = "") =>
  `<rivet-island data-ri="${id}" style="display:contents"><div class="counter"><span>${String(count)}</span><button>+</button><rivet-slot style="display:contents">${slot}</rivet-slot></div></rivet-island>`;

/** Resolvable module promises: `chunk(Counter)` = a loader whose import resolves now / on `release()`. */
export function chunk(component: FakeClientComponent, { held = false }: { held?: boolean } = {}) {
  let release!: () => void;
  const gate = held ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  const loader = Object.assign(
    () => {
      loader.calls++;
      return gate.then(() => ({ default: component, adapter: fakeClient as ClientAdapter }));
    },
    { calls: 0, release: () => release?.() },
  );
  return loader;
}
