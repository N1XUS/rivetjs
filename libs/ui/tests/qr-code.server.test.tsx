// Server-target suite: `QRCode` SSR markup (whole SVG on the server, no script / boundary for a static value), the
// rendered square paths decoded back to the value (independent decoder `libs/cdk/tests/qr-decode.ts`, incl. the
// excavated icon variant), shapes, gradient, icon plate, loading / empty / invalid states, accessible name, and the CSS
// contract (sweeps off under prefers-reduced-motion).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { QRCode, QRCodeRoot, qrCodeVariants } from "../src/components/qr-code/index.ts";
import { decodeQr } from "../../cdk/tests/qr-decode.ts";

const URL_VALUE = "https://rivetjs.severyn.pro/components/qr-code";

/** Rebuilds the module matrix from the `square` body + eyes paths (relative runs: `M x y h n v1 h-n z m dx dy …`). */
const modulesFromSquare = (html: string): { modules: Uint8Array; size: number } => {
  const box = /viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/.exec(html)!;
  const size = Number(box[3]) + 2 * Number(box[1]);
  const modules = new Uint8Array(size * size);
  for (const [, d] of html.matchAll(/<path class="qr-code__(?:body|eyes)" d="([^"]*)"/g)) {
    let x = 0;
    let y = 0;
    for (const m of d!.matchAll(/([Mm])(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g)) {
      if (m[1] === "M") {
        x = Number(m[2]);
        y = Number(m[3]);
      } else {
        x += Number(m[2]);
        y += Number(m[3]);
      }
      for (let i = 0; i < Number(m[4]); i++) modules[y * size + x + i] = 1;
    }
  }
  return { modules, size };
};

test("qr-code: exports + variants", () => {
  assert.equal(QRCode, QRCodeRoot);
  assert.equal(QRCode.Root, QRCodeRoot);
  assert.equal(qrCodeVariants().base(), "qr-code qr-code--default qr-code--square qr-code--md");
});

test("qr-code SSR: full SVG, named by its value, no script, decodes back to the value", async () => {
  const html = await renderToString(() => <QRCode value={URL_VALUE} class="m-2" />);
  assert.match(html, /<div[^>]*class="qr-code qr-code--default qr-code--square qr-code--md m-2"/);
  assert.match(html, /data-slot="qr-code"/);
  assert.match(html, /role="img"/);
  assert.match(html, new RegExp(`aria-label="${URL_VALUE}"`));
  assert.match(html, /<svg class="qr-code__svg" viewBox="-4 -4 /);
  assert.doesNotMatch(html, /data-loading|aria-busy|data-invalid|<script|data-rivet/);
  const { modules, size } = modulesFromSquare(html);
  const out = decodeQr(modules, size);
  assert.equal(out.text, URL_VALUE);
  assert.equal(out.corrected, 0);
});

test("qr-code SSR: icon → ECC H, centred plate, excavated area still decodes", async () => {
  const html = await renderToString(() => (
    <QRCode value={URL_VALUE} aria-label="Docs link">
      <img src="/logo.svg" alt="" />
    </QRCode>
  ));
  assert.match(html, /aria-label="Docs link"/);
  assert.match(html, /<span class="qr-code__icon" data-slot="qr-code-icon" style="--qr-code-icon-size:\d+(\.\d+)?%"><img/);
  const { modules, size } = modulesFromSquare(html);
  const out = decodeQr(modules, size);
  assert.equal(out.text, URL_VALUE);
  assert.equal(out.ecc, "H");
  assert.ok(out.corrected > 0);
});

test("qr-code SSR: shapes, margin, numeric size, gradient preset", async () => {
  const dots = await renderToString(() => <QRCode value="hi" shape="dots" margin={2} size={120} color="brand" />);
  assert.match(dots, /qr-code--brand qr-code--dots/);
  assert.match(dots, /viewBox="-2 -2 25 25"/);
  assert.match(dots, /data-gradient=""/);
  assert.match(dots, /style="--qr-code-size:\s*120px;?"/);
  const id = /<linearGradient id="([\w-]+)"/.exec(dots)![1];
  assert.match(dots, new RegExp(`class="qr-code__body" d="[^"]*" stroke="url\\(#${id}\\)"`));
  assert.match(dots, new RegExp(`class="qr-code__eyes" d="[^"]*" fill="url\\(#${id}\\)"`));
  assert.match(dots, new RegExp(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="21" y2="21">`));
  assert.match(dots, /class="qr-code__body" d="M\d+\.5 \d+\.5h0(m-?\d+ -?\d+h0)+"/);
  const rounded = await renderToString(() => <QRCode value="hi" shape="rounded" />);
  assert.match(rounded, /qr-code--rounded/);
  assert.match(rounded, /A0\.5 0\.5 0 0 1 /);
  assert.doesNotMatch(rounded, /linearGradient/);
});

test("qr-code SSR: loading placeholder (aria-busy) / empty value (hidden) / too long (data-invalid)", async () => {
  const loading = await renderToString(() => <QRCode value="" isLoading aria-label="Payment code" />);
  assert.match(loading, /data-loading=""/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /viewBox="-4 -4 33 33"/); // version-2 placeholder
  const empty = await renderToString(() => <QRCode />);
  assert.match(empty, /aria-hidden="true"/);
  assert.doesNotMatch(empty, /role=|data-loading/);
  const long = await renderToString(() => <QRCode value={"x".repeat(3000)} aria-label="Too long" />);
  assert.match(long, /data-invalid=""/);
  assert.match(long, /class="qr-code__body" d=""/);
});

test("qr-code CSS: sweeps off under prefers-reduced-motion; polarity kept in dark mode", () => {
  const css = readFileSync(new URL("../styles/out/qr-code.css", import.meta.url), "utf8");
  assert.match(css, /animation: [^;]*qr-code-sweep/);
  assert.match(css, /animation: [^;]*qr-code-shimmer/);
  const reduce = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
  assert.match(reduce, /^[^@]*animation: none/);
  assert.match(css, /\.dark \.qr-code, \[data-theme="dark"\] \.qr-code \{\s*--qr-code-fg: var\(--background\);\s*--qr-code-bg: var\(--foreground\);/);
  assert.match(css, /\.qr-code--dots \.qr-code__body \{[^}]*stroke-linecap: round/);
});
