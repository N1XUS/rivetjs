// DOM-target suite (happy-dom): `QRCode` live `value` / `isLoading` update the SVG in place (same nodes, new viewBox +
// paths, name follows), shape variants.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { QRCode } = await import("../src/components/qr-code/index.ts");
const flush = () => new Promise((r) => setTimeout(r, 20));

test("qr-code: live value re-encodes in place", async () => {
  const value = signal("hi");
  const r = render(() => <QRCode value={() => value()} />);
  const root = r.container.querySelector("[data-slot=qr-code]") as HTMLElement;
  const svg = root.querySelector("svg")!;
  const body = root.querySelector(".qr-code__body")!;
  assert.equal(svg.getAttribute("viewBox"), "-4 -4 29 29");
  assert.equal(root.getAttribute("aria-label"), "hi");
  const before = body.getAttribute("d");
  value.set("https://rivetjs.severyn.pro/components/qr-code?with=a-longer-value");
  await flush();
  assert.equal(root.querySelector("svg"), svg);
  assert.equal(root.querySelector(".qr-code__body"), body);
  assert.notEqual(body.getAttribute("d"), before);
  assert.match(svg.getAttribute("viewBox")!, /^-4 -4 (37|41|45) /);
  assert.equal(root.getAttribute("aria-label"), "https://rivetjs.severyn.pro/components/qr-code?with=a-longer-value");
  r.unmount();
});

test("qr-code: live isLoading swaps placeholder ↔ code", async () => {
  const loading = signal(true);
  const r = render(() => <QRCode value="ready" isLoading={() => loading()} shape="dots" />);
  const root = r.container.querySelector("[data-slot=qr-code]") as HTMLElement;
  assert.equal(root.getAttribute("data-loading"), "");
  assert.equal(root.getAttribute("aria-busy"), "true");
  assert.equal(root.querySelector("svg")!.getAttribute("viewBox"), "-4 -4 33 33");
  loading.set(false);
  await flush();
  assert.equal(root.hasAttribute("data-loading"), false);
  assert.equal(root.hasAttribute("aria-busy"), false);
  assert.equal(root.querySelector("svg")!.getAttribute("viewBox"), "-4 -4 29 29");
  assert.match(root.querySelector(".qr-code__body")!.getAttribute("d")!, /h0/);
  r.unmount();
});
