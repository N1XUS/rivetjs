// Server spreads: absent (null / undefined) values allocate no record, branded record arrays and inert
// omitted slots skip the renderer's identity / thenable probes — same markup, same admission order
// (TRANSFORM-AUDIT X1–X3).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compiledTemplate, omitted, renderToString, renderToWriter, spreadAttributes, template } from "../server.ts";

const element = (attrs: object, tag = "div") => compiledTemplate([`<${tag}`, `></${tag}>`], [spreadAttributes(attrs, tag)]);

test("absent spread values render nothing and allocate no record", () => {
  const records = spreadAttributes({ id: "a", title: undefined, "aria-label": null, hidden: false }, "div");
  assert.deepEqual(
    records.map((r) => [r.name, r.value]),
    [
      ["id", "a"],
      ["hidden", false],
    ],
  );
  assert.equal(renderToString(element({ id: "a", title: undefined, "aria-label": null })), '<div id="a"></div>');
  // Unsafe names still throw for an absent value.
  assert.throws(() => spreadAttributes({ innerHTML: undefined }, "div"), /Unsafe attribute name/);
  assert.throws(() => spreadAttributes({ onclick: undefined }, "div"), /Unsafe attribute name/);
  // `on[A-Z]` keys are listeners (skipped); `on` + lowercase is an attribute name (throws above).
  assert.equal(spreadAttributes({ onClick: undefined, onKeyDown: () => {} }, "div").length, 0);
});

test("an absent value overrides an earlier key of the same name, and keeps its position for a later one", () => {
  // Later absent alias clears the earlier value.
  assert.equal(renderToString(element({ className: "a", id: "x", class: undefined })), '<div id="x"></div>');
  assert.equal(renderToString(element({ tabIndex: 1, tabindex: null })), "<div></div>");
  // Earlier absent alias: the later value renders at the first key's position (as before records were skipped).
  assert.equal(renderToString(element({ class: undefined, id: "x", className: "b" })), '<div class="b" id="x"></div>');
  assert.equal(renderToString(element({ htmlFor: null, id: "x", for: "f" }, "label")), '<label for="f" id="x"></label>');
  // Absent, present, absent again: cleared, and nothing left over.
  assert.equal(renderToString(element({ class: undefined, className: "b", id: "x", CLASS: null })), '<div id="x"></div>');
  assert.deepEqual(
    spreadAttributes({ class: undefined, id: "x", className: "b" }, "div").map((r) => r.name),
    ["class", "id"],
  );
});

test("media URL names keep the media namespace; other names skip the check", () => {
  assert.deepEqual(
    spreadAttributes({ src: "a", srcset: "b", alt: "c", title: "d" }, "img").map((r) => [r.name, r.namespace]),
    [
      ["src", "media"],
      ["srcset", "media"],
      ["alt", "html"],
      ["title", "html"],
    ],
  );
  assert.deepEqual(
    spreadAttributes({ poster: "p", src: "s" }, "video").map((r) => r.namespace),
    ["media", "media"],
  );
  assert.equal(spreadAttributes({ src: "s" }, "script")[0]!.namespace, "html");
  // First-letter gate (s / p, any case) before the regex; same-length names starting otherwise stay html.
  assert.deepEqual(
    spreadAttributes({ SRC: "a", Poster: "b", span: "c", href: "d" }, "video").map((r) => [r.name, r.namespace]),
    [
      ["src", "media"],
      ["poster", "media"],
      ["span", "html"],
      ["href", "html"],
    ],
  );
});

test("a spread value's thenable is still admitted before output (records skip only the array's own probe)", async () => {
  const log: string[] = [];
  const thenable = {
    get then() {
      log.push("get");
      return (resolve: (value: string) => void) => resolve("later");
    },
  } as PromiseLike<string>;
  const chunks: string[] = [];
  await renderToWriter(
    compiledTemplate(
      ["<div", ">", "</div>"],
      [
        spreadAttributes({ id: "a", title: thenable, hidden: undefined }, "div"),
        () => {
          log.push("child");
          return "x";
        },
      ],
    ),
    {
      write(chunk) {
        log.push("write");
        chunks.push(chunk);
      },
    },
  );
  assert.equal(chunks.join(""), '<div id="a" title="later">x</div>');
  assert.equal(log[0], "get");
  assert.ok(log.indexOf("get") < log.indexOf("write"));
  // An accessor returning a promise: awaited at its attribute.
  assert.equal(await renderToString(element({ title: () => Promise.resolve("p"), id: undefined })), '<div title="p"></div>');
});

test("omitted handler slots are inert; a function with its own `then` is still observed", async () => {
  let calls = 0;
  const handler = () => calls++;
  assert.equal(renderToString(compiledTemplate(["<button", ">b</button>"], [omitted(handler)])), "<button>b</button>");
  assert.equal(renderToString(compiledTemplate(["<button", ">b</button>"], [omitted(async () => calls++)])), "<button>b</button>");
  assert.equal(renderToString(compiledTemplate(["<button", ">b</button>"], [omitted(undefined)])), "<button>b</button>");
  assert.equal(calls, 0);
  // A function carrying an own `then` is a thenable: awaited in its slot (it never invokes the handler itself).
  let thens = 0;
  const thenableHandler = Object.assign(() => calls++, {
    then(resolve: () => void) {
      thens++;
      resolve();
    },
  });
  const out = renderToString(compiledTemplate(["<button", ">b</button>"], [omitted(thenableHandler)]));
  assert.equal(typeof (out as PromiseLike<string>).then, "function");
  assert.equal(await out, "<button>b</button>");
  assert.ok(thens >= 1);
  assert.equal(calls, 0);
});

// SSR-OMITTED-SLOTS (review LOW-2): string / byte writers inline an all-primitive spread (`spreadString`);
// a raw `template()` slot takes the generic per-record path (`templateSequence`). Both must write the same bytes.
test("inline primitive spreads write the same bytes as the generic per-record path (string + byte writers)", async () => {
  const { Writable } = await import("node:stream");
  const { NodeStreamWriter } = await import("../node.ts");
  const bytes = async (value: Parameters<typeof renderToString>[0]) => {
    const parts: Buffer[] = [];
    const sink = new Writable({ write: (chunk: Buffer, _encoding, done) => (parts.push(Buffer.from(chunk)), done()) });
    const writer = new NodeStreamWriter(sink);
    await renderToWriter(value, writer);
    await writer.finish?.();
    return Buffer.concat(parts).toString("utf8");
  };
  const cases: [string, Record<string, unknown>][] = [
    ["boolean", { hidden: true, disabled: false, inert: 0, open: "", checked: 1 }],
    ["aria", { "aria-label": 'say "hi" & <bye>', "aria-hidden": true, "aria-expanded": false, "aria-level": 2, role: "tab" }],
    ["class", { class: "a b", className: "c <d>", id: "x" }],
    ["style", { style: { color: "red", width: 10, "--gap": "1px", opacity: 0 }, title: "t" }],
    ["unsafe href", { href: "javascript:alert(1)", title: "x" }],
    ["unsafe href mixed", { id: "l", href: " JaVaScRiPt:void 0", rel: "noopener", "data-n": 3 }],
    ["safe href", { href: "/a?b=1&c=<2>", "aria-current": "page" }],
    ["absent", { id: "z", title: undefined, "aria-label": null, tabIndex: -1 }],
  ];
  for (const [name, attrs] of cases) {
    const tag = name.includes("href") ? "a" : "div";
    const inline = element(attrs, tag);
    const generic = () => template([`<${tag}`, `></${tag}>`], [spreadAttributes(attrs, tag)]);
    const expected = renderToString(generic()) as string;
    assert.equal(renderToString(inline), expected, `${name}: string writer`);
    assert.equal(await bytes(element(attrs, tag)), expected, `${name}: byte writer`);
    assert.equal(await bytes(generic()), expected, `${name}: byte writer, generic`);
  }
  // The unsafe URL is neutralized either way (and so takes the generic path inside records).
  assert.match(renderToString(element({ href: "javascript:alert(1)" }, "a")) as string, /href="about:invalid#rivet"/);
});
