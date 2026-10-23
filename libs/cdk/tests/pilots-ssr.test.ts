// Server rendering of the B2 pilot components (resume-mode server compile, `tests/server.ts`).
// - "Breadcrumbs SSR" ported from react-aria-components test/Breadcrumbs.ssr.test.js (react-spectrum, Apache-2.0,
//   © Adobe). Changes: rendered with `resumableToString` and parsed with happy-dom; the hydration half of the
//   upstream test (React hydrate) is covered by the resumed story app (`tests-components/links.test.ts`).
// - Rivet: signal-driven Breadcrumbs items serialize (resumable collection recipe / renderer / aria-current).
// - Rivet: FocusableContext (TooltipTrigger / PreviewTrigger trigger props) DOM attributes reach the server
//   markup of Button and Link (RA useFocusable merges every context DOM prop; own props win).
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { importModule, renderHtml } from "./server.ts";

installDom();

const fixture = await importModule<{ Crumbs(): unknown; Triggers(): unknown; Dynamic(): unknown; Handlers(): unknown }>(
  "pilots-fixture.tsx",
  `
import { computed, signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { FocusableProvider } from "@rivetjs/cdk/focusable";

export function Crumbs() {
  return (
    <Breadcrumbs>
      <Breadcrumb>One</Breadcrumb>
      <Breadcrumb>Two</Breadcrumb>
      <Breadcrumb>Three</Breadcrumb>
    </Breadcrumbs>
  );
}

const all = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
export function Dynamic() {
  const depth = signal(2);
  const visible = computed(() => all.slice(0, depth()));
  return (
    <Breadcrumbs items={visible} onAction={() => depth.set(1)}>
      {(item) => (
        <Breadcrumb>
          <Link>{item.label}</Link>
        </Breadcrumb>
      )}
    </Breadcrumbs>
  );
}

export function Handlers() {
  const log = signal("");
  return (
    <Breadcrumbs>
      <Breadcrumb id="home" lang="en" onPointerEnter={() => log.set("li")}>
        <Link href="#home">Home</Link>
      </Breadcrumb>
      <Breadcrumb id="here">
        <Link>Here</Link>
      </Breadcrumb>
    </Breadcrumbs>
  );
}

export function Triggers() {
  const open = false;
  return (
    <div>
      <FocusableProvider aria-haspopup="dialog" aria-expanded={() => open} aria-controls="pop" data-trigger="preview">
        <Link id="l" href="#x">Link</Link>
      </FocusableProvider>
      <FocusableProvider aria-haspopup="dialog" aria-expanded={() => open} aria-controls="pop" aria-describedby="tip">
        <Button id="b" aria-describedby="own">Button</Button>
      </FocusableProvider>
    </div>
  );
}
`,
);

const parse = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("Breadcrumbs SSR", () => {
  test("should render without errors", async () => {
    const host = parse(await renderHtml(() => fixture.Crumbs()));
    const items = [...host.querySelectorAll("li")];
    assert.deepEqual(
      items.map((o) => o.textContent),
      ["One", "Two", "Three"],
    );
    assert.equal(host.querySelector("ol")!.getAttribute("aria-label"), "Breadcrumbs");
    assert.deepEqual(
      items.map((o) => o.getAttribute("data-current")),
      [null, null, "true"],
    );
  });
});

describe("Breadcrumbs SSR (Rivet)", () => {
  // The reactive bindings (data-current / aria-current over the built collection) must serialize: the
  // collection recipe, the default CollectionRenderer and an accessor aria-current from LinkContext.
  test("signal-driven items resume (every capture serializable)", async () => {
    const host = parse(await renderHtml(() => fixture.Dynamic()));
    const items = [...host.querySelectorAll("li")];
    assert.deepEqual(
      items.map((o) => o.getAttribute("data-current")),
      [null, "true"],
    );
    assert.equal(host.querySelectorAll(".rv-Link")[1]!.getAttribute("aria-current"), "page");
  });
});

describe("Breadcrumb DOM events (SSR)", () => {
  // A handler created in the (unrecorded) collection build pass must still resume when the built node
  // renders: "Cannot resume spread event handler" before the runtime registered build-pass closures.
  test("an on* handler on a Breadcrumb resumes (forwarded to its <li>)", async () => {
    const html = await renderHtml(() => fixture.Handlers());
    const host = parse(html);
    assert.equal(host.querySelector("li")!.getAttribute("lang"), "en");
    assert.match(html, /<!--b\d+--><ol class="rv-Breadcrumbs"/, "the handler's component is a boundary");
  });
});

describe("FocusableContext DOM attributes (SSR)", () => {
  test("Link: aria-haspopup / accessor aria-expanded / aria-controls / data-* from context", async () => {
    const host = parse(await renderHtml(() => fixture.Triggers()));
    const link = host.querySelector("#l")!;
    assert.equal(link.getAttribute("aria-haspopup"), "dialog");
    assert.equal(link.getAttribute("aria-expanded"), "false");
    assert.equal(link.getAttribute("aria-controls"), "pop");
    assert.equal(link.getAttribute("data-trigger"), "preview");
  });

  test("Button: context attributes; own props win", async () => {
    const host = parse(await renderHtml(() => fixture.Triggers()));
    const button = host.querySelector("#b")!;
    assert.equal(button.getAttribute("aria-haspopup"), "dialog");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(button.getAttribute("aria-controls"), "pop");
    assert.equal(button.getAttribute("aria-describedby"), "own");
  });
});
