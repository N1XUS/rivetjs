// Server rendering of `@rivetjs/cdk/overflow` through Breadcrumbs `overflowMode="collapse"` (resume-mode server compile,
// `tests/server.ts`). Rivet-only (Spectrum has no SSR test for collapsing): the server renders every breadcrumb (Spectrum's
// initial state) or `defaultVisibleItems`; every capture of the measuring client effect, the overflow rows and the
// `renderOverflow` menu serializes (`resumableToString` throws on an unserializable capture).
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { importModule, renderHtml } from "./server.ts";

installDom();

const fixture = await importModule<{ All(): unknown; Collapsed(): unknown }>(
  "overflow-fixture.tsx",
  `
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";

function Trail(props) {
  return (
    <Breadcrumbs
      overflowMode="collapse"
      showRoot
      defaultVisibleItems={props.visible}
      renderOverflow={(items) => (
        <MenuTrigger>
          <Button aria-label="More">More</Button>
          <Popover>
            <Menu items={items}>{(item) => <MenuItem id={item.key} href={item.href}>{item.textValue}</MenuItem>}</Menu>
          </Popover>
        </MenuTrigger>
      )}
    >
      <Breadcrumb id="home"><Link href="/">Home</Link></Breadcrumb>
      <Breadcrumb id="docs" textValue="Docs"><Link href="/docs">Docs</Link></Breadcrumb>
      <Breadcrumb id="cdk"><Link href="/docs/cdk">cdk</Link></Breadcrumb>
      <Breadcrumb id="here"><Link>Breadcrumbs</Link></Breadcrumb>
    </Breadcrumbs>
  );
}

export const All = () => <Trail />;
export const Collapsed = () => <Trail visible={2} />;
`,
);

const parse = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("Breadcrumbs overflowMode=collapse SSR", () => {
  test("renders every breadcrumb by default (the browser measures)", async () => {
    const host = parse(await renderHtml(() => fixture.All()));
    assert.deepEqual(
      [...host.querySelectorAll("li")].map((li) => li.textContent),
      ["Home", "Docs", "cdk", "Breadcrumbs"],
    );
    assert.equal(host.querySelector("[data-overflow]"), null);
    assert.equal(host.querySelector('[aria-current="page"]')!.textContent, "Breadcrumbs");
  });

  test("defaultVisibleItems: root + overflow item + last, the overflow trigger server-rendered", async () => {
    const host = parse(await renderHtml(() => fixture.Collapsed()));
    const items = [...host.querySelectorAll("ol > li")];
    assert.equal(items.length, 3);
    assert.equal(items[0]!.textContent, "Home");
    assert.equal(items[1]!.getAttribute("data-overflow"), "true");
    assert.equal(items[1]!.querySelector("button")!.getAttribute("aria-haspopup"), "true");
    assert.equal(items[2]!.textContent, "Breadcrumbs");
    assert.equal(items[2]!.getAttribute("data-current"), "true");
  });
});
