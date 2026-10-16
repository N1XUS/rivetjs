import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString, renderToWriter, template, attribute } from "../server.ts";

/** Renders here are asynchronous, so the `string | Promise` / `void | Promise` results are promises. */
const rejects = (value: unknown, error: Parameters<typeof assert.rejects>[1]): Promise<void> => assert.rejects(value as Promise<unknown>, error);
test("async nested children escape text and preserve order", async () => {
  assert.equal(await renderToString(template(["<div>", "</div>"], [[Promise.resolve("<&"), [1, false, null, 2]]])), "<div>&lt;&amp;12</div>");
});
test("attribute values enforce boolean, escaping and safe URL boundaries", async () => {
  assert.equal(await renderToString(template(["<input", ">"], [attribute("disabled", true)])), "<input disabled>");
  assert.equal(await renderToString(template(["<a", ">x</a>"], [attribute("href", "javascript:alert(1)")])), '<a href="about:invalid#rivet">x</a>');
});
test("awaits writer backpressure before subsequent writes and propagates failure", async () => {
  const chunks: string[] = [];
  let release: (() => void) | undefined;
  const pending = renderToWriter(template(["a", "c"], ["b"]), {
    write(s: string) {
      chunks.push(s);
      if (s === "a") return new Promise<void>((r) => (release = r));
    },
  });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(chunks, ["a"]);
  release!();
  await pending;
  assert.deepEqual(chunks, ["a", "b", "c"]);
  await rejects(
    renderToWriter(["a", "b"], {
      write() {
        throw new Error("sink failed");
      },
    }),
    /sink failed/,
  );
});
test("abort interrupts unresolved async children and pending writes", async () => {
  for (const value of [new Promise<string>(() => {}), "text"]) {
    const controller = new AbortController();
    const pending = renderToWriter(
      value,
      {
        write() {
          return new Promise(() => {});
        },
      },
      { signal: controller.signal },
    );
    controller.abort(new Error("cancelled"));
    await rejects(pending, /cancelled/);
  }
});
test("synchronous output stays synchronous until an actual async boundary", () => {
  const value = template(["<div>", "</div>"], [["a", 1, template(["<b>static</b>"])]]);
  const chunks: string[] = [];
  assert.equal(
    renderToWriter(value, {
      write(chunk: string) {
        chunks.push(chunk);
      },
    }),
    undefined,
  );
  assert.equal(chunks.join(""), "<div>a1<b>static</b></div>");
  assert.equal(renderToString(value), "<div>a1<b>static</b></div>");
});
test("unsafe raw HTML, style and event attributes are rejected by public helpers", () => {
  for (const name of ["onClick", "srcdoc", "innerHTML", "dangerouslySetInnerHTML", "style"])
    assert.throws(() => attribute(name, "<script>alert(1)</script>"), /Unsafe/);
});

test("template traversal resumes each alternating position after writer suspension", async () => {
  for (let blocked = 0; blocked < 5; blocked++) {
    const chunks: string[] = [];
    let release: (() => void) | undefined;
    const pending = renderToWriter(template(["a", "c", "e"], ["b", "d"]), {
      write(chunk: string) {
        chunks.push(chunk);
        if (chunks.length - 1 === blocked)
          return new Promise<void>((resolve) => {
            release = resolve;
          });
      },
    });
    assert.deepEqual(chunks, ["a", "b", "c", "d", "e"].slice(0, blocked + 1));
    release!();
    await pending;
    assert.deepEqual(chunks, ["a", "b", "c", "d", "e"]);
  }
});

test("suspended traversal preserves captured length and reads later values when visited", async () => {
  for (const region of [false, true]) {
    const values = ["b", "d"];
    const fragments = ["a", "c", "e"];
    const chunks: string[] = [];
    let release: (() => void) | undefined;
    const value = region ? template(fragments, values) : values;
    const pending = renderToWriter(value, {
      write(chunk: string) {
        chunks.push(chunk);
        if (chunks.length === 1)
          return new Promise<void>((resolve) => {
            release = resolve;
          });
      },
    });
    values[1] = "D";
    values.push("ignored");
    fragments[1] = "C";
    release!();
    await pending;
    assert.equal(chunks.join(""), region ? "abCDe" : "bD");
  }
});

test("hidden keeps a string keyword verbatim (until-found); other boolean values and attributes are unchanged", async () => {
  const { attribute, compiledTemplate, spreadAttributes, _list, _listPlan } = await import("../server.ts");
  const el = (value: unknown, name = "hidden") => renderToString(compiledTemplate(["<div", "></div>"], [attribute(name, value)]));
  assert.equal(el("until-found"), '<div hidden="until-found"></div>');
  assert.equal(el('a"<'), '<div hidden="a&quot;&lt;"></div>');
  assert.equal(el(true), "<div hidden></div>");
  assert.equal(el(1), "<div hidden></div>");
  assert.equal(el(""), "<div></div>");
  assert.equal(el(false), "<div></div>");
  assert.equal(el(null), "<div></div>");
  assert.equal(el("until-found", "disabled"), "<div disabled></div>");
  assert.equal(el("until-found", "HIDDEN"), '<div hidden="until-found"></div>');
  assert.equal(renderToString(compiledTemplate(["<div", "></div>"], [spreadAttributes({ hidden: "until-found" }, "div")])), '<div hidden="until-found"></div>');
  const plan = _listPlan(["<p", "></p>"], [["hidden", "html"]]);
  const list = _list(
    ["until-found", true, false],
    (v) => v,
    plan,
    (tape, base, v) => void (tape[base] = v),
  );
  assert.equal(renderToString(list as never), '<p hidden="until-found"></p><p hidden></p><p></p>');
});

test("HTML attribute names render lowercase (React-style encType / readOnly / tabIndex); SVG / MathML keep their case", async () => {
  const { attribute, compiledTemplate, spreadAttributes, _list, _listPlan } = await import("../server.ts");
  const one = (tag: string, name: string, value: unknown, namespace?: "svg" | "mathml" | "media") =>
    renderToString(compiledTemplate([`<${tag}`, `></${tag}>`], [attribute(name, value, namespace)]));
  assert.equal(await one("form", "encType", "multipart/form-data"), '<form enctype="multipart/form-data"></form>');
  assert.equal(await one("input", "readOnly", true), "<input readonly></input>");
  assert.equal(await one("input", "tabIndex", 2), '<input tabindex="2"></input>');
  assert.equal(await one("video", "crossOrigin", "anonymous", "media"), '<video crossorigin="anonymous"></video>');
  assert.equal(await one("div", "className", "a"), '<div class="a"></div>');
  assert.equal(await one("svg", "viewBox", "0 0 1 1", "svg"), '<svg viewBox="0 0 1 1"></svg>');
  assert.equal(await one("math", "displayStyle", "true", "mathml"), '<math displayStyle="true"></math>');
  // Spreads: the same rule; an HTML `readOnly` and `readonly` are one attribute (later wins).
  assert.equal(
    await renderToString(compiledTemplate(["<input", ">"], [spreadAttributes({ readOnly: true, tabIndex: 1, readonly: false, maxLength: 3 }, "input")])),
    '<input tabindex="1" maxlength="3">',
  );
  assert.equal(
    await renderToString(compiledTemplate(["<svg", "></svg>"], [spreadAttributes({ viewBox: "0 0 2 2" }, "svg", "svg")])),
    '<svg viewBox="0 0 2 2"></svg>',
  );
  // Compiler list plans (row attribute names are compile-time literals).
  const plan = _listPlan(
    ["<input", "><svg", "></svg>"],
    [
      ["readOnly", "html"],
      ["viewBox", "svg"],
    ],
  );
  const list = _list(
    [true],
    (v) => v,
    plan,
    (tape, base, v) => void ((tape[base] = v), (tape[base + 1] = "0 0 3 3")),
  );
  assert.equal(await renderToString(list as never), '<input readonly><svg viewBox="0 0 3 3"></svg>');
});
