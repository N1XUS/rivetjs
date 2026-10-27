import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Window } from "happy-dom";
import { fieldText, validateResponse } from "../loadgen/validate.ts";

for (const name of ["rivet", "rivet-for", "solid", "qwik", "solid-stable", "solid-stable-string", "solid-stable-static", "solid-stable-interactive", "qwik-stable", "react-static", "react-interactive"]) {
  test(`${name} production adapter renders all fixture fields and escaped identity`, async () => {
    const { renderPage } = (await import(`../dist/${name}.mjs`)) as typeof import("../adapters/rivet.ts");
    let html = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        html += chunk.toString();
        done();
      },
    });
    await renderPage(
      {
        title: "A < B & C",
        token: '"><script>alert(1)</script>',
        markdown: "",
        rows: [{ id: 1, values: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109] }],
      },
      { signal: new AbortController().signal, articleHtml: "" },
      sink,
    );
    assert.match(html, /A &lt; B &amp; C/);
    assert.equal((html.match(/<dd\b/g) ?? []).length, 10);
    assert.match(html, /109/);
    // A '<' inside a safely quoted attribute is valid HTML; inspect parsed semantics, not encoding style.
    const window = new Window();
    const template = window.document.createElement("template");
    template.innerHTML = html;
    const document = template.content; // Inert parsing: bootstrap/preload tags never execute or fetch.
    assert.equal(document.querySelector("main")?.getAttribute("data-token"), '"><script>alert(1)</script>');
    assert.equal(document.querySelector("title")?.textContent, "A < B & C");
    assert.deepEqual([...document.querySelectorAll("dd")].map(cell => cell.textContent),
      Array.from({ length: 10 }, (_, index) => String(100 + index)));
    assert.ok([...document.querySelectorAll("script")].every(script => script.textContent !== "alert(1)"));
    await window.happyDOM.close();
    assert.match(html, /<\/body>/);
    assert.match(html, /<\/html>/);
  });
}

// Escaping variant (B5, strings=1) and text grid (strings=2): text values with markup-significant (+ non-ASCII)
// characters in every lane, checked with the load generator's exact parsed-text validator (each framework may pick
// its own valid encoding).
for (const name of ["rivet", "rivet-compiled", "rivet-for", "solid", "qwik", "solid-stable", "solid-stable-string", "solid-stable-static", "solid-stable-interactive", "qwik-stable", "react-static", "react-interactive"])
  for (const profile of [1, 2])
  test(`${name} escapes the strings=${profile} variant exactly`, async () => {
    const { renderPage } = (await import(`../dist/${name}.mjs`)) as typeof import("../adapters/rivet.ts");
    let html = "";
    const sink = new Writable({ write(chunk: Buffer, _encoding, done) { html += chunk.toString("latin1"); done(); } });
    const rows = Array.from({ length: 12 }, (_, id) => ({ id, values: Array.from({ length: 10 }, (_, field) => fieldText(id, field, profile)) }));
    await renderPage({ title: "Escaping", token: "esc", markdown: "", rows }, { signal: new AbortController().signal, articleHtml: "" }, sink);
    html += "<!--complete-->"; // server.ts appends the completion marker after the adapter
    assert.ok(validateResponse(200, html, 12, "esc", false, profile), html.slice(0, 2000));
    assert.equal(validateResponse(200, html, 12, "esc"), false);
    assert.equal(validateResponse(200, html, 12, "esc", false, 3 - profile), false);
  });

test("solid-stable-static emits no hydration keys while solid-stable keeps them", async () => {
  const render = async (name: string) => {
    const { renderPage } = (await import(`../dist/${name}.mjs`)) as typeof import("../adapters/rivet.ts");
    let html = "";
    const sink = new Writable({ write(chunk: Buffer, _encoding, done) { html += chunk.toString(); done(); } });
    await renderPage({ title: "t", token: "k", markdown: "", rows: [{ id: 1, values: Array.from({ length: 10 }, (_, i) => i) }] }, { signal: new AbortController().signal, articleHtml: "" }, sink);
    return html;
  };
  assert.match(await render("solid-stable"), /data-hk=/);
  assert.doesNotMatch(await render("solid-stable-static"), /data-hk=|_\$HY/);
});

test("solid-stable-interactive does rivet-resume's row work: links, signal attribute, hydration keys, serialized page data", async () => {
  const { renderPage } = (await import(`../dist/${"solid-stable-interactive"}.mjs`)) as typeof import("../adapters/rivet.ts");
  let html = "";
  const sink = new Writable({ write(chunk: Buffer, _encoding, done) { html += chunk.toString(); done(); } });
  const rows = [7, 8].map((id) => ({ id, values: Array.from({ length: 10 }, (_, i) => id * 1000 + i) }));
  await renderPage({ title: "t", token: "k", markdown: "", rows }, { signal: new AbortController().signal, articleHtml: "" }, sink);
  assert.match(html, /data-hk=/);
  assert.equal((html.match(/data-state="even"/g) ?? []).length, 2);
  assert.match(html, /href="\/resume\?rows=8"/);
  assert.match(html, /<nav>/);
  // The page data (every row value) travels in the hydration script, like Rivet's resume state.
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  assert.match(scripts, /_\$HY/);
  assert.match(scripts, /8009/);
});

test("react-static ships no script while react-interactive does rivet-resume's row work: links, state attribute, page data, bootstrap script", async () => {
  const render = async (name: string) => {
    const { renderPage } = (await import(`../dist/${name}.mjs`)) as typeof import("../adapters/rivet.ts");
    let html = "";
    const sink = new Writable({ write(chunk: Buffer, _encoding, done) { html += chunk.toString(); done(); } });
    const rows = [7, 8].map((id) => ({ id, values: Array.from({ length: 10 }, (_, i) => id * 1000 + i) }));
    await renderPage({ title: "t", token: "k", markdown: "", rows }, { signal: new AbortController().signal, articleHtml: "" }, sink);
    return html;
  };
  const staticHtml = await render("react-static");
  assert.doesNotMatch(staticHtml, /<script\b|<a\b/);
  assert.match(staticHtml, /^<!DOCTYPE html>/);
  const html = await render("react-interactive");
  assert.equal((html.match(/data-state="even"/g) ?? []).length, 2);
  assert.match(html, /href="\/resume\?rows=8"/);
  assert.match(html, /<nav>/);
  assert.match(html, /<script src="\/assets\/react-client\.js" async="">/);
  // The page data (every row value) travels in the bootstrap script for hydrateRoot, like Rivet's resume state.
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  assert.match(scripts, /window\.__PAGE__=/);
  assert.match(scripts, /8009/);
});

for (const [framework, packageName, version] of [
  ["react-static", "react-dom", "19.3.0"],
  ["react-interactive", "react-dom", "19.3.0"],
  ["solid-stable", "solid-js", "1.9.15"],
  ["solid-stable-string", "solid-js", "1.9.15"],
  ["solid-stable-static", "solid-js", "1.9.15"],
  ["solid-stable-interactive", "solid-js", "1.9.15"],
  ["qwik-stable", "@builder.io/qwik", "1.20.1"],
]) {
  test(`${framework} records its exact stable version and bundles its isolated runtime`, async () => {
    const artifacts = JSON.parse(await readFile(new URL("../dist/builds.json", import.meta.url), "utf8")).artifacts as
      Array<{ framework: string; version: string; outputMode: string; implementation: string; inputs: string[] }>;
    const artifact = artifacts.find(item => item.framework === framework)!;
    assert.ok(artifact, "stable lane must have a separate build artifact");
    assert.equal(artifact.version, version);
    assert.equal(artifact.outputMode, { "solid-stable-string": "buffered-renderToString", "solid-stable-static": "buffered-static-renderToString" }[framework!] ?? "streaming-adapter");
    assert.match(artifact.implementation, /production SSR|static SSR/);
    const require = createRequire(new URL("../../bench-stable/package.json", import.meta.url));
    let directory = dirname(require.resolve(packageName!));
    for (;;) {
      try {
        const info = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
        if (info.name === packageName) { assert.equal(info.version, version); break; }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const parent = dirname(directory);
      assert.notEqual(parent, directory, "stable package manifest must be found");
      directory = parent;
    }
    const runtimeInputs = artifact.inputs.filter(input => input.includes(`/node_modules/${packageName}/`) || input.startsWith(`node_modules/${packageName}/`));
    assert.ok(runtimeInputs.length > 0, "framework runtime must be bundled");
    assert.ok(runtimeInputs.every(input => resolve(input).startsWith(directory + "/")), "preview runtime must not enter a stable bundle");
    assert.ok(artifact.inputs.every(input => !/node_modules\/(?:@qwik\.dev\/core|@solidjs\/(?:web|core))\//.test(input)),
      "preview-only framework packages must not enter stable bundles");
  });
}

for (const framework of ["solid-stable", "solid-stable-string", "qwik-stable", "react-static"]) {
  test(`${framework} preserves the caller-owned response under backpressure`, async () => {
    const { renderPage } = await import(`../dist/${framework}.mjs`) as typeof import("../adapters/rivet.ts");
    let pending = 0, written = "";
    const sink = new Writable({ highWaterMark: 1, write(chunk: Buffer, _encoding, done) {
      pending++;
      setTimeout(() => { written += chunk.toString(); pending--; done(); }, 2);
    } });
    await renderPage({ title: "Empty", token: "empty", rows: [] }, { signal: new AbortController().signal, articleHtml: "<p>article</p>" }, sink);
    assert.equal(sink.writableEnded, false);
    await new Promise<void>((resolve, reject) => { sink.once("error", reject); sink.end(resolve); });
    assert.equal(pending, 0);
    assert.match(written, /<p>article<\/p>/);
    assert.match(written, /<\/html>/);
  });
  test(`${framework} rejects an already aborted response`, async () => {
    const { renderPage } = await import(`../dist/${framework}.mjs`) as typeof import("../adapters/rivet.ts");
    const controller = new AbortController(); controller.abort();
    const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
    await assert.rejects(renderPage({ title: "Aborted", token: "aborted", rows: [] }, { signal: controller.signal }, sink));
  });
}


test("Qwik stable large pages preserve every value without accumulating backpressure listeners", async () => {
  const { renderPage } = await import("../dist/qwik-stable.mjs" as string) as typeof import("../adapters/rivet.ts");
  let html = "", maxDrainListeners = 0;
  const sink = new Writable({ highWaterMark: 1, write(chunk: Buffer, _encoding, done) {
    html += chunk.toString(); setTimeout(done, 1);
  } });
  sink.on("newListener", type => {
    if (type === "drain") maxDrainListeners = Math.max(maxDrainListeners, sink.listenerCount("drain") + 1);
  });
  const rows = Array.from({ length: 1000 }, (_, id) => ({ id, values: Array.from({ length: 10 }, (_, field) => id * 100 + field) }));
  await renderPage({ title: "Large page", token: "large", rows }, { signal: new AbortController().signal, articleHtml: "" }, sink);
  await new Promise<void>((resolve, reject) => { sink.once("error", reject); sink.end(resolve); });
  const content = html.replace(/<!--[^]*?-->/g, "");
  assert.deepEqual([...content.matchAll(/<dd\b[^>]*>([0-9]+)<\/dd>/g)].map(match => Number(match[1])), rows.flatMap(row => row.values));
  assert.ok(maxDrainListeners <= 1, "only one unresolved transport write may wait for drain");
});


for (const abort of [false, true]) {
  test(`Solid stable string ${abort ? "cancels" : "completes"} a large response under backpressure`, async () => {
    const { renderPage } = await import("../dist/solid-stable-string.mjs" as string) as typeof import("../adapters/rivet.ts");
    const controller = new AbortController();
    let release: (() => void) | undefined;
    let started!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    let html = "", settled = false;
    const sink = new Writable({ highWaterMark: 1, write(chunk: Buffer, _encoding, done) {
      html += chunk.toString();
      release = done;
      started();
    } });
    const rows = Array.from({ length: 1000 }, (_, id) => ({ id, values: Array.from({ length: 10 }, (_, field) => id * 100 + field) }));
    const rendering = renderPage({ title: "Large page", token: "large", rows }, { signal: controller.signal, articleHtml: "" }, sink);
    void rendering.then(() => { settled = true; }, () => { settled = true; });
    await writing;
    await Promise.resolve();
    assert.equal(settled, false, "rendering must wait while the response exceeds the transport buffer limit");
    assert.equal(sink.writableEnded, false);
    if (abort) {
      const failure = new Error("cancel held response");
      const rejected = assert.rejects(rendering, error => error === failure);
      controller.abort(failure);
      await rejected;
      assert.equal(sink.listenerCount("drain"), 0, "cancelled writer releases its drain wait");
      assert.equal(sink.listenerCount("error"), 0);
      assert.equal(sink.listenerCount("close"), 0);
      release!();
    } else {
      release!();
      await rendering;
      const content = html.replace(/<!--[^]*?-->/g, "");
      assert.deepEqual([...content.matchAll(/<dd\b[^>]*>([0-9]+)<\/dd>/g)].map(match => Number(match[1])), rows.flatMap(row => row.values));
      assert.match(html, /<\/html>$/);
    }
    assert.equal(sink.writableEnded, false, "the HTTP server owns response completion");
    await new Promise<void>(resolve => sink.end(resolve));
  });
}
