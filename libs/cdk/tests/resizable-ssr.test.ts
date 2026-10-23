// Server rendering of `@rivetjs/cdk/resizable` (port of react-resizable-panels 4.14.3, MIT, © Brian Vaughn): the
// upstream markup + inline flex styles from the first byte — `defaultLayout` (e.g. a cookie-stored layout) as
// `flex-grow`, else panel `defaultSize` as `flex-basis` (no layout shift), separators with role / orientation /
// tabindex / `data-separator`, ids + `data-testid`.
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Group, Panel, Separator, useDefaultLayout, usePanelRef, cookieStorage } from "@rivetjs/cdk/resizable";

export function Basic(props) {
  return (
    <Group id="g" orientation={props.orientation} defaultLayout={props.layout}>
      <Panel id="left" defaultSize={props.size ?? "30%"} minSize={100}>left</Panel>
      <Separator id="sep" />
      <Panel id="right" class="content">right</Panel>
    </Group>
  );
}

export function Persisted(props) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail", storage: cookieStorage(props.cookie) });
  const ref = usePanelRef();
  return (
    <Group id="p" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <Panel id="a" panelRef={ref} collapsible onResize={(size) => console.debug(size.asPercentage)}>a</Panel>
      <Separator id="s" disabled />
      <Panel id="b">b</Panel>
    </Group>
  );
}
`;

type Fixture = { Basic(props: Record<string, unknown>): unknown; Persisted(props: Record<string, unknown>): unknown };
const load = () => importModule<Fixture>("resizable-ssr-fixture.tsx", source);
const tag = (html: string, attr: string) => html.match(new RegExp(`<div[^>]*${attr}[^>]*>`))?.[0] ?? "";

describe("Resizable SSR", () => {
  it("renders group, panels and separator markup", async () => {
    const { Basic } = await load();
    const html = await renderHtml(() => Basic({}));
    const group = tag(html, 'data-group="true"');
    expect(group).toMatch(/id="g"/);
    expect(group).toMatch(/data-testid="g"/);
    expect(group).toMatch(/display:\s*flex/);
    expect(group).toMatch(/flex-direction:\s*row/);
    expect(group).toMatch(/touch-action:\s*pan-y/);
    const left = tag(html, 'id="left"');
    expect(left).toMatch(/data-panel="true"/);
    expect(left).toMatch(/flex-basis:\s*30%/);
    const right = tag(html, 'id="right"');
    expect(right).toMatch(/flex-grow:\s*1/);
    expect(html).toMatch(/<div class="content" style="[^"]*overflow:\s*auto/);
    const separator = tag(html, 'role="separator"');
    expect(separator).toMatch(/aria-orientation="vertical"/);
    expect(separator).toMatch(/tabindex="0"/);
    expect(separator).toMatch(/data-separator="inactive"/);
    expect(separator).toMatch(/touch-action:\s*none/);
    expect(separator).not.toMatch(/aria-valuenow/);
  });

  it("renders a vertical group and pixel / unitless sizes", async () => {
    const { Basic } = await load();
    const html = await renderHtml(() => Basic({ orientation: "vertical", size: 200 }));
    expect(tag(html, 'data-group="true"')).toMatch(/flex-direction:\s*column/);
    expect(tag(html, 'id="left"')).toMatch(/flex-basis:\s*200px/);
    expect(tag(html, 'role="separator"')).toMatch(/aria-orientation="horizontal"/);
    const unitless = await renderHtml(() => Basic({ size: "40" }));
    expect(tag(unitless, 'id="left"')).toMatch(/flex-basis:\s*40%/);
  });

  it("renders a default layout as flex-grow", async () => {
    const { Basic } = await load();
    const html = await renderHtml(() => Basic({ layout: { left: 25, right: 75 } }));
    expect(tag(html, 'id="left"')).toMatch(/flex-grow:\s*25/);
    expect(tag(html, 'id="right"')).toMatch(/flex-grow:\s*75/);
  });

  it("renders a cookie-stored layout (no layout shift)", async () => {
    const { Persisted } = await load();
    const cookie = "theme=dark; " + encodeURIComponent("react-resizable-panels:mail") + "=" + encodeURIComponent(JSON.stringify({ a: 20, b: 80 }));
    const html = await renderHtml(() => Persisted({ cookie }));
    expect(tag(html, 'id="a"')).toMatch(/flex-grow:\s*20/);
    expect(tag(html, 'id="b"')).toMatch(/flex-grow:\s*80/);
    const separator = tag(html, 'role="separator"');
    expect(separator).toMatch(/data-separator="disabled"/);
    expect(separator).toMatch(/aria-disabled="true"/);
    expect(separator).not.toMatch(/tabindex/);
  });
});
