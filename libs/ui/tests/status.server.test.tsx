// Server-target suite: `Status` SSR markup (pure markup, no boundary) + its CSS contract (pulse off under reduced motion).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Status } from "../src/components/status/index.ts";

test("status SSR: span with default colour + size, decorative without a label", async () => {
  const html = await renderToString(() => <Status class="ms-1" />);
  assert.match(html, /<span[^>]*class="status status--default status--md ms-1"/);
  assert.match(html, /data-slot="status"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role=/);
  assert.doesNotMatch(html, /data-rivet|<script/);
});

test("status SSR: colour, size, pulse and a label (role img)", async () => {
  const html = await renderToString(() => <Status color="success" size="lg" pulse aria-label="Online" id="presence" />);
  assert.match(html, /class="status status--success status--pulse status--lg"/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Online"/);
  assert.match(html, /id="presence"/);
  assert.doesNotMatch(html, /aria-hidden/);
});

test("status SSR: aria-labelledby also names it", async () => {
  const html = await renderToString(() => <Status color="danger" size="sm" aria-labelledby="busy-label" />);
  assert.match(html, /class="status status--danger status--sm"/);
  assert.match(html, /role="img"/);
});

test("status CSS: pulse ring is off under prefers-reduced-motion", () => {
  const css = readFileSync(new URL("../styles/out/status.css", import.meta.url), "utf8");
  assert.match(css, /\.status--pulse:after\s*\{[^}]*animation:[^}]*status-pulse/);
  const reduce = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
  assert.match(reduce, /^[^@]*\.status--pulse:after\s*\{[^}]*animation: none/);
  for (const color of ["default", "accent", "success", "warning", "danger"]) assert.match(css, new RegExp(`\\.status--${color}\\s*\\{\\s*--status-color:`));
});
