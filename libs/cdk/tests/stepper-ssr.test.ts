// Server rendering of `@rivetjs/cdk/stepper` (port of Angular CDK stepper, MIT, © Google LLC): Material's accessible
// markup from the first byte (tablist / tab / tabpanel, roving tabindex, aria-disabled for linear steps), list
// semantics (`ol` / `li` / `aria-current="step"`), read-only headers, a linear stepper starting past step 0.
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Stepper, StepList, Step, StepHeader, StepLabel, StepPanel } from "@rivetjs/cdk/stepper";

export function Tabs(props) {
  return (
    <Stepper id="s" linear={props.linear} defaultSelectedIndex={props.start} orientation={props.orientation}>
      <StepList aria-label="Checkout">
        <Step label="Cart"><StepHeader /></Step>
        <Step label="Shipping"><StepHeader><StepLabel>Ship</StepLabel></StepHeader></Step>
        <Step label="Pay" optional><StepHeader /></Step>
      </StepList>
      <StepPanel index={0}>cart</StepPanel>
      <StepPanel index={1}>shipping</StepPanel>
      <StepPanel index={2}>pay</StepPanel>
    </Stepper>
  );
}

export function List(props) {
  return (
    <Stepper id="l" semantics="list" defaultSelectedIndex={1} isReadOnly={props.readOnly} aria-label="Progress">
      <Step label="One"><StepHeader /></Step>
      <Step label="Two"><StepHeader /></Step>
      <Step label="Three"><StepHeader /></Step>
    </Stepper>
  );
}
`;

type Fixture = { Tabs(props: Record<string, unknown>): unknown; List(props: Record<string, unknown>): unknown };
const load = () => importModule<Fixture>("stepper-ssr-fixture.tsx", source);
const tags = (html: string, attr: string) => [...html.matchAll(new RegExp(`<[a-z]+[^>]*${attr}[^>]*>`, "g"))].map((m) => m[0]);

describe("Stepper SSR", () => {
  it("renders the horizontal tabs markup", async () => {
    const { Tabs } = await load();
    const html = await renderHtml(() => Tabs({}));
    expect(html).toMatch(/<div[^>]*role="tablist"[^>]*>/);
    expect(html).toMatch(/aria-orientation="horizontal"/);
    expect(html).toMatch(/aria-label="Checkout"/);
    const headers = tags(html, 'role="tab"');
    expect(headers).toHaveLength(3);
    expect(headers[0]).toMatch(/aria-selected="true"/);
    expect(headers[0]).toMatch(/tabindex="0"/);
    expect(headers[1]).toMatch(/aria-selected="false"/);
    expect(headers[1]).toMatch(/tabindex="-1"/);
    expect(headers[0]).toMatch(/id="s-label-0"/);
    expect(headers[2]).toMatch(/aria-controls="s-content-2"/);
    expect(headers.every((h) => !/aria-disabled/.test(h))).toBe(true);
    expect(html).toContain(">Cart<");
    expect(html).toContain(">Ship<");
    const panels = tags(html, 'role="tabpanel"');
    expect(panels).toHaveLength(3);
    expect(panels[0]).not.toMatch(/hidden/);
    expect(panels[0]).toMatch(/data-position="current"/);
    expect(panels[1]).toMatch(/hidden/);
    expect(panels[1]).toMatch(/data-position="next"/);
    expect(panels[1]).toMatch(/aria-labelledby="s-label-1"/);
  });

  it("marks non-navigable steps of a linear stepper aria-disabled", async () => {
    const { Tabs } = await load();
    const headers = tags(await renderHtml(() => Tabs({ linear: true })), 'role="tab"');
    expect(headers.map((h) => /aria-disabled="true"/.test(h))).toEqual([false, true, true]);
  });

  it("marks the steps before a pre-selected index of a linear stepper as visited", async () => {
    const { Tabs } = await load();
    const html = await renderHtml(() => Tabs({ linear: true, start: 2 }));
    const headers = tags(html, 'role="tab"');
    expect(headers.map((h) => /aria-disabled="true"/.test(h))).toEqual([false, false, false]);
    expect(headers[0]).toMatch(/data-completed="true"/);
    expect(headers[0]).toMatch(/data-state="edit"/);
  });

  it("renders vertical headers as buttons with aria-expanded / aria-current", async () => {
    const { Tabs } = await load();
    const html = await renderHtml(() => Tabs({ orientation: "vertical" }));
    expect(html).not.toMatch(/role="tablist"/);
    const headers = tags(html, 'data-rv-step-header="s"');
    expect(headers[0]).toMatch(/role="button"/);
    expect(headers[0]).toMatch(/aria-expanded="true"/);
    expect(headers[0]).toMatch(/aria-current="step"/);
    expect(headers[1]).toMatch(/aria-expanded="false"/);
    expect(tags(html, 'role="region"')).toHaveLength(3);
  });

  it("renders list semantics", async () => {
    const { List } = await load();
    const html = await renderHtml(() => List({}));
    expect(html).toMatch(/<ol[^>]*aria-label="Progress"/);
    const items = tags(html, "data-index=");
    expect(items).toHaveLength(3);
    expect(items[1]).toMatch(/^<li[^>]*aria-current="step"/);
    expect(items[0]).not.toMatch(/aria-current/);
    expect(html.match(/<button[^>]*type="button"/g)).toHaveLength(3);
    expect(html).not.toMatch(/role="tab"/);
  });

  it("renders read-only list headers without buttons", async () => {
    const { List } = await load();
    const html = await renderHtml(() => List({ readOnly: true }));
    expect(html).not.toMatch(/<button/);
    expect(html).toMatch(/data-readonly="true"/);
  });
});
