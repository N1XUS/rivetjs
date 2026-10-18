// @rivetjs/bridge, libs/bridge/boot.ts (excerpt): the islands-only lean boot. No island chunk or prefetch
// starts before the first paint, so none of them lands on Lighthouse's simulated FCP / LCP path.
const doc = document;
let open!: (value?: unknown) => void;
const idle = new Promise((go) => {
  open = go;
  const Observer = self.PerformanceObserver;
  const slice = (): unknown => (self.requestIdleCallback ?? setTimeout)(go as () => void);
  // The cap first (armed now when `load` already fired), so nothing below can keep the gate shut.
  const cap = (): unknown => setTimeout(slice, 1e3);
  doc.readyState == "complete" ? cap() : addEventListener("load", cap);
  Observer?.supportedEntryTypes?.includes("paint") ? new Observer(slice).observe({ type: "paint", buffered: true }) : slice();
});

// Per island record: every policy trigger imports through the same gate.
const start = (): unknown =>
  idle
    .then(() => import(url))
    .then(async (mod: { default: unknown; adapter: { hydrate: Function; mount: Function } }) => {
      // … adapter.hydrate(root, mod.default, props, {}, ctx); on a throw, mount over the server HTML
    }, fail("chunk failed to load"))
    .catch(fail("failed to start"));

// An `interaction` island (document pointerdown / keydown) opens the gate for everyone: the user is here.
const types = ["pointerdown", "keydown"];
const once = (): void => {
  for (const type of types) doc.removeEventListener(type, once, true);
  open();
  start();
};
for (const type of types) doc.addEventListener(type, once, true);
