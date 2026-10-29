// DOM-target suite (happy-dom): root hooks `useMounted` / `useIsHydrated` (false → true after the client effect),
// `useMediaQuery` (initial + change events + accessor query), `useMeasuredHeight` (ResizeObserver), `useTheme` (html class /
// data-theme / color-scheme, system follows prefers-color-scheme, storage), `useSafeLayoutEffect` / `useIsomorphicLayoutEffect`
// (= clientEffect, cleanup on unmount), `useListData` (cdk createListData under the HeroUI name).
import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const hooks = await import("../index.ts");
const flush = () => new Promise((r) => setTimeout(r, 10));

interface FakeList {
  matches: boolean;
  media: string;
  listeners: Set<(e: { matches: boolean }) => void>;
  addEventListener(type: string, fn: (e: { matches: boolean }) => void): void;
  removeEventListener(type: string, fn: (e: { matches: boolean }) => void): void;
}
const lists = new Map<string, FakeList>();
const g = globalThis as Record<string, unknown>;
g.matchMedia = (media: string): FakeList => {
  let list = lists.get(media);
  if (!list) {
    list = {
      matches: false,
      media,
      listeners: new Set(),
      addEventListener(_type, fn) {
        this.listeners.add(fn);
      },
      removeEventListener(_type, fn) {
        this.listeners.delete(fn);
      },
    };
    lists.set(media, list);
  }
  return list;
};
const setMatch = (media: string, matches: boolean) => {
  const list = g.matchMedia as (m: string) => FakeList;
  const l = list(media);
  l.matches = matches;
  for (const fn of [...l.listeners]) fn({ matches });
};
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

beforeEach(() => {
  lists.clear();
  store.clear();
  const root = document.documentElement;
  root.className = "";
  root.removeAttribute("data-theme");
  root.removeAttribute("style");
});

test("useMounted / useIsHydrated: false first, true after the client effect", async () => {
  let mounted!: () => boolean;
  let hydrated!: () => boolean;
  const r = render(() => {
    mounted = hooks.useMounted();
    hydrated = hooks.useIsHydrated();
    return <span>{() => `${mounted()}/${hydrated()}`}</span>;
  });
  assert.equal(r.container.textContent, "false/false");
  await flush();
  assert.equal(r.container.textContent, "true/true");
  r.unmount();
});

test("useMediaQuery: default, real match after mount, follows change, stops after unmount", async () => {
  (g.matchMedia as (m: string) => FakeList)("(min-width: 600px)").matches = true;
  let wide!: () => boolean;
  const r = render(() => {
    wide = hooks.useMediaQuery("(min-width: 600px)");
    return <span>{() => String(wide())}</span>;
  });
  assert.equal(r.container.textContent, "false", "defaultValue before the client effect");
  await flush();
  assert.equal(r.container.textContent, "true");
  setMatch("(min-width: 600px)", false);
  assert.equal(r.container.textContent, "false");
  r.unmount();
  assert.equal(lists.get("(min-width: 600px)")!.listeners.size, 0);
});

test("useMediaQuery: defaultValue and accessor query", async () => {
  const q = signal("(a)");
  let m!: () => boolean;
  const r = render(() => {
    m = hooks.useMediaQuery(() => q(), true);
    return <span>{() => String(m())}</span>;
  });
  assert.equal(r.container.textContent, "true");
  await flush();
  assert.equal(r.container.textContent, "false", "(a) does not match");
  q.set("(b)");
  setMatch("(b)", true);
  await flush();
  assert.equal(r.container.textContent, "true");
  assert.equal(lists.get("(a)")!.listeners.size, 0, "old subscription dropped");
  r.unmount();
});

test("useMeasuredHeight: 0, then the observed height", async () => {
  const observers: Array<{ cb: (e: unknown[]) => void; disconnected: boolean }> = [];
  const Original = g.ResizeObserver;
  g.ResizeObserver = class {
    state: { cb: (e: unknown[]) => void; disconnected: boolean };
    constructor(cb: (e: unknown[]) => void) {
      this.state = { cb, disconnected: false };
      observers.push(this.state);
    }
    observe() {}
    disconnect() {
      this.state.disconnected = true;
    }
  };
  try {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({ height: 40 }) as DOMRect;
    let h!: () => number;
    const r = render(() => {
      h = hooks.useMeasuredHeight(el);
      return <span>{() => String(h())}</span>;
    });
    assert.equal(r.container.textContent, "0");
    await flush();
    assert.equal(r.container.textContent, "40");
    observers[0]!.cb([{ contentRect: { height: 72 } }]);
    assert.equal(r.container.textContent, "72");
    r.unmount();
    assert.equal(observers[0]!.disconnected, true);
    // no element → 0, no observer
    const none = render(() => {
      h = hooks.useMeasuredHeight(() => null);
      return <span>{() => String(h())}</span>;
    });
    await flush();
    assert.equal(none.container.textContent, "0");
    none.unmount();
  } finally {
    g.ResizeObserver = Original;
  }
});

test("useTheme: setTheme writes class / data-theme / color-scheme; system follows prefers-color-scheme; storage", async () => {
  const root = document.documentElement;
  let t!: ReturnType<typeof hooks.useTheme>;
  const r = render(() => {
    t = hooks.useTheme({ storageKey: "k" });
    return <span>{() => `${t.theme()}>${t.resolvedTheme()}`}</span>;
  });
  await flush();
  assert.equal(r.container.textContent, "system>light");
  assert.equal(root.className, "", "nothing written until a choice is made");
  t.setTheme("dark");
  await flush();
  assert.equal(r.container.textContent, "dark>dark");
  assert.ok(root.classList.contains("dark") && !root.classList.contains("light"));
  assert.equal(root.getAttribute("data-theme"), "dark");
  assert.match(root.getAttribute("style") ?? "", /color-scheme:\s*dark/);
  assert.equal(store.get("k"), "dark");
  t.setTheme("system");
  setMatch("(prefers-color-scheme: dark)", true);
  await flush();
  assert.equal(r.container.textContent, "system>dark");
  assert.equal(root.getAttribute("data-theme"), "dark");
  setMatch("(prefers-color-scheme: dark)", false);
  await flush();
  assert.equal(root.getAttribute("data-theme"), "light");
  r.unmount();
  // a stored choice wins on the next mount and is applied
  store.set("k", "dark");
  const r2 = render(() => {
    t = hooks.useTheme({ storageKey: "k" });
    return <span>{() => t.theme()}</span>;
  });
  await flush();
  assert.equal(r2.container.textContent, "dark");
  assert.equal(root.getAttribute("data-theme"), "dark");
  r2.unmount();
});

test("useTheme: adopts what <html> shows when nothing is stored", async () => {
  document.documentElement.classList.add("dark");
  let t!: ReturnType<typeof hooks.useTheme>;
  const r = render(() => {
    t = hooks.useTheme();
    return <span>{() => t.theme()}</span>;
  });
  await flush();
  assert.equal(r.container.textContent, "dark");
  r.unmount();
});

test("useSafeLayoutEffect / useIsomorphicLayoutEffect: clientEffect (runs after mount, cleanup on unmount)", async () => {
  assert.equal(hooks.useSafeLayoutEffect, hooks.useIsomorphicLayoutEffect);
  const log: string[] = [];
  const r = render(() => {
    hooks.useSafeLayoutEffect(() => {
      log.push("run");
      return () => log.push("cleanup");
    });
    return <i />;
  });
  assert.deepEqual(log, []);
  await flush();
  assert.deepEqual(log, ["run"]);
  r.unmount();
  assert.deepEqual(log, ["run", "cleanup"]);
});

test("useListData: HeroUI name over cdk createListData", async () => {
  let list!: ReturnType<typeof hooks.useListData<{ id: number; n: string }>>;
  const r = render(() => {
    list = hooks.useListData({ initialItems: [{ id: 1, n: "a" }], getKey: (i) => i.id });
    return (
      <span>
        {() =>
          list
            .items()
            .map((i) => i.n)
            .join(",")
        }
      </span>
    );
  });
  assert.equal(r.container.textContent, "a");
  list.append({ id: 2, n: "b" });
  assert.equal(r.container.textContent, "a,b");
  list.remove(1);
  assert.equal(r.container.textContent, "b");
  r.unmount();
});
