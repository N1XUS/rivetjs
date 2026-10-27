// Kit's DOM head manager (happy-dom): a route head that matches the server's JSON-LD keeps the server element (no
// script text write: under Trusted Types that write needs the `rivet-script` policy).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { jsonLdTag } from "@rivetjs/router/head";

test("route head clears omitted title and owned root attributes and reconciles base", async () => {
  const window = new Window({ url: "https://x.test/" });
  const global = globalThis as unknown as Record<string, unknown>;
  const saved = global.document;
  global.document = window.document;
  const { document } = window;
  try {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.setAttribute("id", "shell");
    document.head.innerHTML = '<title>Server title</title><base href="/server/">';
    const { applyRouteHead } = await import("../dom.ts");
    applyRouteHead({});
    await Promise.resolve();
    assert.equal(document.title, "Server title", "a revived payload has no head and does not own the server title");
    assert.equal(document.head.querySelector("base")!.getAttribute("href"), "/server/");
    applyRouteHead({
      head: { title: "A", html: { class: "checkout", constructor: "head-owned" }, body: { class: "page-a" }, base: { href: "/a/", target: "_blank" } },
    });
    await Promise.resolve();
    assert.equal(document.title, "A");
    assert.equal(document.documentElement.getAttribute("class"), "checkout");
    assert.equal(document.head.querySelector("base")!.getAttribute("href"), "/a/");
    applyRouteHead({ head: { base: { href: "/b/" } } });
    await Promise.resolve();
    assert.equal(document.title, "");
    assert.equal(document.documentElement.hasAttribute("class"), false);
    assert.equal(document.documentElement.hasAttribute("constructor"), false);
    assert.equal(document.body.hasAttribute("class"), false);
    assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
    assert.equal(document.body.id, "shell");
    assert.equal(document.head.querySelectorAll("base").length, 1);
    assert.equal(document.head.querySelector("base")!.getAttribute("href"), "/b/");
    assert.equal(document.head.querySelector("base")!.hasAttribute("target"), false);
    applyRouteHead({ head: {} });
    await Promise.resolve();
    assert.equal(document.head.querySelector("base"), null);
  } finally {
    global.document = saved;
    await window.happyDOM.close();
  }
});

test("a resumed page's route head keeps the server JSON-LD block (escaped text, root layout data-rh=0) as it is", async () => {
  const window = new Window({ url: "https://x.test/" });
  const global = globalThis as unknown as Record<string, unknown>;
  const saved = { document: global.document };
  global.document = window.document;
  try {
    const data = { "@type": "Organization", name: "A <b> & c" };
    window.document.head.innerHTML = jsonLdTag(data, undefined, ' data-rh="0"') + jsonLdTag({ x: 1 }, "page", ' data-rh=""');
    const [server, page] = [...window.document.head.querySelectorAll("script")];
    const { applyRouteHead } = await import("../dom.ts");
    applyRouteHead({ head: { scripts: [{ jsonLd: data }, { jsonLd: { x: 2 }, id: "page" }] } });
    await new Promise((done) => setTimeout(done, 0));
    const now = [...window.document.head.querySelectorAll("script")];
    assert.equal(now[0], server, "equal block kept (same element)");
    assert.equal(now[0]!.textContent, server!.textContent);
    // A changed block (same id) is replaced.
    assert.notEqual(now[1], page);
    assert.equal(now[1]!.textContent, '{"x":2}');
    assert.equal(now.length, 2);
  } finally {
    global.document = saved.document;
    await window.happyDOM.close();
  }
});
