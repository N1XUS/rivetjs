// DOM-target suite: `Avatar` (upstream avatar tests ported + the radix avatar 1.2.6 primitive behaviour): fallback until the image
// loads, `<img>` after `load`, error keeps the fallback, cached image = loaded at once, accessor `src` re-probes, `delayMs`,
// `onLoadingStatusChange` sequence, probe attribute order, slot classes through context.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const window = installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { signal } = await import("@rivetjs/reactivity");
const { Avatar, AvatarRoot, AvatarImage, AvatarFallback, avatarVariants, AVATAR_GROUP_CHILD } = await import("../src/components/avatar/index.ts");
const { AvatarGroupContext } = await import("../src/components/avatar-group/avatar-group-context.ts");

/** Stub of `window.Image` (radix probe): records instances + the order attributes were set; tests fire `load` / `error` by hand. */
class FakeImage {
  static instances: FakeImage[] = [];
  /** Cached-image emulation: `src` values whose probe is already `complete` with a width. */
  static cached = new Set<string>();
  listeners: Record<string, ((event: Event) => void)[]> = {};
  order: string[] = [];
  complete = false;
  naturalWidth = 0;
  #src = "";
  #referrerPolicy = "";
  #crossOrigin: string | null = null;
  constructor() {
    FakeImage.instances.push(this);
  }
  get src() {
    return this.#src;
  }
  set src(v: string) {
    this.#src = v;
    this.order.push("src");
    if (FakeImage.cached.has(v)) {
      this.complete = true;
      this.naturalWidth = 1;
    }
  }
  get referrerPolicy() {
    return this.#referrerPolicy;
  }
  set referrerPolicy(v: string) {
    this.#referrerPolicy = v;
    this.order.push("referrerPolicy");
  }
  get crossOrigin() {
    return this.#crossOrigin;
  }
  set crossOrigin(v: string | null) {
    this.#crossOrigin = v;
    this.order.push("crossOrigin");
  }
  addEventListener(type: string, fn: (event: Event) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: (event: Event) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  /** Fire `load` (the image becomes complete with a width) or `error`. */
  fire(type: "load" | "error") {
    if (type === "load") {
      this.complete = true;
      this.naturalWidth = 1;
    }
    for (const fn of this.listeners[type] ?? []) fn({ currentTarget: this } as unknown as Event);
  }
}
(window as unknown as { Image: unknown }).Image = FakeImage;
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const last = () => FakeImage.instances[FakeImage.instances.length - 1];

const mount = () =>
  render(() => (
    <Avatar size="lg" color="accent" class="x">
      <Avatar.Image src="https://example.test/a.png" alt="A" />
      <Avatar.Fallback>AB</Avatar.Fallback>
    </Avatar>
  ));

test("avatar: initial markup is the fallback only (no img); slot classes through context", async () => {
  FakeImage.instances = [];
  const r = mount();
  await flush();
  const root = r.container.firstElementChild!;
  assert.equal(root.tagName, "SPAN");
  assert.equal(root.className, avatarVariants({ color: "accent", size: "lg" }).base({ class: "x" }));
  assert.match(root.className, /avatar--lg/);
  assert.equal(root.querySelector("img"), null);
  const fb = root.querySelector("[data-slot=avatar-fallback]")!;
  assert.equal(fb.textContent, "AB");
  assert.equal(fb.className, avatarVariants({ color: "accent", size: "lg" }).fallback());
  assert.match(fb.className, /avatar__fallback--accent/);
  r.unmount();
});

test("avatar: image load → <img> appears, fallback removed", async () => {
  FakeImage.instances = [];
  const r = mount();
  await flush();
  assert.equal(last().src, "https://example.test/a.png");
  last().fire("load");
  const img = r.container.querySelector("img")!;
  assert.ok(img);
  assert.equal(img.getAttribute("src"), "https://example.test/a.png");
  assert.equal(img.getAttribute("alt"), "A");
  assert.equal(img.className, "avatar__image");
  assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
  r.unmount();
});

test("avatar: image error keeps the fallback, no img", async () => {
  FakeImage.instances = [];
  const r = mount();
  await flush();
  last().fire("error");
  assert.equal(r.container.querySelector("img"), null);
  assert.ok(r.container.querySelector("[data-slot=avatar-fallback]"));
  r.unmount();
});

test("avatar: empty src = error (no probe); referrerPolicy / crossOrigin reach the probe", async () => {
  FakeImage.instances = [];
  const seen: string[] = [];
  const r = render(() => (
    <Avatar>
      <Avatar.Image onLoadingStatusChange={(s) => seen.push(s)} />
      <Avatar.Fallback>F</Avatar.Fallback>
    </Avatar>
  ));
  await flush();
  assert.deepEqual(seen, ["error"]);
  assert.equal(FakeImage.instances.length, 0);
  r.unmount();
  const p = render(() => (
    <Avatar>
      <Avatar.Image src="/x.png" crossOrigin="anonymous" referrerPolicy="no-referrer" />
    </Avatar>
  ));
  await flush();
  assert.equal(last().crossOrigin, "anonymous");
  assert.equal(last().referrerPolicy, "no-referrer");
  assert.deepEqual(last().order, ["referrerPolicy", "crossOrigin", "src"], "referrerPolicy / crossOrigin are set before src");
  p.unmount();
  // No crossOrigin prop: the probe's crossOrigin is set to null (upstream `crossOrigin ?? null`), referrerPolicy untouched.
  const q = render(() => (
    <Avatar>
      <Avatar.Image src="/y.png" />
    </Avatar>
  ));
  await flush();
  assert.deepEqual(last().order, ["crossOrigin", "src"]);
  assert.equal(last().crossOrigin, null);
  q.unmount();
});

test("avatar: onLoadingStatusChange sequence is loading → loaded", async () => {
  FakeImage.instances = [];
  const seen: string[] = [];
  const r = render(() => (
    <Avatar>
      <Avatar.Image src="/a.png" onLoadingStatusChange={(s) => seen.push(s)} />
    </Avatar>
  ));
  await flush();
  assert.deepEqual(seen, ["loading"]);
  last().fire("load");
  assert.deepEqual(seen, ["loading", "loaded"]);
  r.unmount();
  // The probe's listeners are removed on unmount: a late event is ignored.
  assert.deepEqual(last().listeners, { load: [], error: [] });
  last().fire("error");
  assert.deepEqual(seen, ["loading", "loaded"]);
});

test("avatar: a cached image (complete with a width) is loaded at once — no fallback flash", async () => {
  FakeImage.instances = [];
  FakeImage.cached.add("/cached.png");
  const seen: string[] = [];
  const r = render(() => (
    <Avatar>
      <Avatar.Image src="/cached.png" alt="C" onLoadingStatusChange={(s) => seen.push(s)} />
      <Avatar.Fallback>F</Avatar.Fallback>
    </Avatar>
  ));
  // Before the client effect: the fallback (= server markup).
  assert.ok(r.container.querySelector("[data-slot=avatar-fallback]"));
  await flush();
  assert.deepEqual(seen, ["loaded"], "no intermediate loading status");
  assert.equal(r.container.querySelector("img")?.getAttribute("alt"), "C");
  assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
  FakeImage.cached.delete("/cached.png");
  r.unmount();
});

test("avatar: a complete probe without a width is an error", async () => {
  FakeImage.instances = [];
  const seen: string[] = [];
  class CompleteEmpty extends FakeImage {
    override get src() {
      return super.src;
    }
    override set src(v: string) {
      super.src = v;
      this.complete = true;
      this.naturalWidth = 0;
    }
  }
  (window as unknown as { Image: unknown }).Image = CompleteEmpty;
  try {
    const r = render(() => (
      <Avatar>
        <Avatar.Image src="/empty.png" onLoadingStatusChange={(s) => seen.push(s)} />
        <Avatar.Fallback>F</Avatar.Fallback>
      </Avatar>
    ));
    await flush();
    assert.deepEqual(seen, ["error"]);
    assert.ok(r.container.querySelector("[data-slot=avatar-fallback]"));
    assert.equal(r.container.querySelector("img"), null);
    r.unmount();
  } finally {
    (window as unknown as { Image: unknown }).Image = FakeImage;
  }
});

test("avatar: an accessor src re-probes on change (img swapped, fallback back while loading, status sequence)", async () => {
  FakeImage.instances = [];
  const src = signal<string | undefined>("/one.png");
  const seen: string[] = [];
  const r = render(() => (
    <Avatar>
      <Avatar.Image src={src} alt="S" onLoadingStatusChange={(s) => seen.push(s)} />
      <Avatar.Fallback>F</Avatar.Fallback>
    </Avatar>
  ));
  await flush();
  assert.equal(FakeImage.instances.length, 1);
  last().fire("load");
  assert.equal(r.container.querySelector("img")?.getAttribute("src"), "/one.png");
  assert.deepEqual(seen, ["loading", "loaded"]);
  const first = last();
  src.set("/two.png");
  // New probe; the old one's listeners are gone; the img is unmounted while loading and the fallback is back.
  assert.equal(FakeImage.instances.length, 2);
  assert.deepEqual(first.listeners, { load: [], error: [] });
  assert.equal(last().src, "/two.png");
  assert.equal(r.container.querySelector("img"), null);
  assert.ok(r.container.querySelector("[data-slot=avatar-fallback]"));
  assert.deepEqual(seen, ["loading", "loaded", "loading"], "cleanup idle + loading are one batched change");
  last().fire("load");
  assert.equal(r.container.querySelector("img")?.getAttribute("src"), "/two.png");
  assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
  assert.deepEqual(seen, ["loading", "loaded", "loading", "loaded"]);
  // Cached swap: loaded at once; loaded → (idle →) loaded is no observed change (upstream: one batched render, same status).
  FakeImage.cached.add("/three.png");
  src.set("/three.png");
  assert.deepEqual(seen, ["loading", "loaded", "loading", "loaded"]);
  assert.equal(r.container.querySelector("img")?.getAttribute("src"), "/three.png");
  FakeImage.cached.delete("/three.png");
  // Cleared src: error, fallback, no new probe.
  src.set(undefined);
  assert.equal(FakeImage.instances.length, 3);
  assert.equal(r.container.querySelector("img"), null);
  assert.deepEqual(seen, ["loading", "loaded", "loading", "loaded", "error"]);
  r.unmount();
});

test("avatar: Fallback delayMs hides the fallback until the timer fires; hidden for good once loaded", async () => {
  vi.useFakeTimers();
  try {
    FakeImage.instances = [];
    const r = render(() => (
      <Avatar>
        <Avatar.Fallback delayMs={200}>F</Avatar.Fallback>
      </Avatar>
    ));
    await flush();
    assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
    vi.advanceTimersByTime(199);
    assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
    vi.advanceTimersByTime(1);
    assert.equal(r.container.querySelector("[data-slot=avatar-fallback]")?.textContent, "F");
    r.unmount();
  } finally {
    vi.useRealTimers();
  }
});

test("avatar: a live Fallback delayMs restarts the timer (upstream effect deps [delayMs])", async () => {
  vi.useFakeTimers();
  try {
    FakeImage.instances = [];
    const delay = signal(500);
    const r = render(() => (
      <Avatar>
        <Avatar.Fallback delayMs={delay()}>F</Avatar.Fallback>
      </Avatar>
    ));
    await flush();
    vi.advanceTimersByTime(100);
    delay.set(150);
    await flush();
    vi.advanceTimersByTime(149);
    assert.equal(r.container.querySelector("[data-slot=avatar-fallback]"), null);
    vi.advanceTimersByTime(1);
    assert.equal(r.container.querySelector("[data-slot=avatar-fallback]")?.textContent, "F");
    r.unmount();
  } finally {
    vi.useRealTimers();
  }
});

test("avatar: AvatarGroupContext props apply to every Avatar unless AVATAR_GROUP_CHILD is false; own props win; parts outside an Avatar", () => {
  const r = render(() => (
    <Provider token={AvatarGroupContext} value={{ size: "sm", color: "danger", variant: "soft" }}>
      {() => (
        <>
          <Avatar />
          <Avatar {...{ [AVATAR_GROUP_CHILD]: false }} />
          <Avatar size="lg" />
        </>
      )}
    </Provider>
  ));
  const [a, b, c] = Array.from(r.container.querySelectorAll("span"));
  assert.match(a.className, /avatar--sm/);
  assert.match(a.className, /avatar--soft/);
  assert.match(b.className, /avatar--md/);
  assert.doesNotMatch(b.className, /avatar--soft/);
  assert.match(c.className, /avatar--lg/);
  r.unmount();
  const o = render(() => <AvatarFallback class="solo">x</AvatarFallback>);
  assert.equal(o.container.firstElementChild?.className, "solo");
  o.unmount();
  const i = render(() => <AvatarImage class="solo" src="" />);
  i.unmount();
  assert.equal(Avatar, AvatarRoot);
  assert.equal(Avatar.Image, AvatarImage);
});

test("avatar: hard-coded defaults equal avatarVariants defaultVariants (re-vendor drift guard)", () => {
  const r = render(() => (
    <Avatar>
      <Avatar.Fallback>D</Avatar.Fallback>
    </Avatar>
  ));
  assert.equal(r.container.firstElementChild?.className, avatarVariants().base());
  assert.equal(r.container.querySelector("[data-slot=avatar-fallback]")?.className, avatarVariants().fallback());
  r.unmount();
});
