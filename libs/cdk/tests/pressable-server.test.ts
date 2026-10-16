// PressResponder dev warning on the server: RA warns in a `useEffect` (never run in SSR), so server renders never warn. Rivet
// regression: a trigger passed through a wrapper (`<div>{props.children}</div>`, HeroUI ColorPicker root) is a slot-valued
// template hole the server calls while serializing — after the responder's synchronous check — so SSR warned for a registered
// trigger. The client-render warning for a genuinely missing pressable child: `pressable.browser.test.tsx`.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const src = `
import { PressResponder } from "../interactions/pressable.tsx";
import { Button } from "../button/index.tsx";
import { DialogTrigger } from "../dialog/index.tsx";
function Wrapper(props) {
  return <div class="wrap">{props.children}</div>;
}
function Root(props) {
  return (
    <DialogTrigger>
      <div data-slot="root">{props.children}</div>
    </DialogTrigger>
  );
}
export function Wrapped() {
  return (
    <PressResponder onPress={() => {}}>
      <Wrapper>
        <Button>Open</Button>
      </Wrapper>
    </PressResponder>
  );
}
export function TriggerThroughRoot() {
  return (
    <Root>
      <Button>Open</Button>
    </Root>
  );
}
export function NoPressable() {
  return (
    <PressResponder>
      <div>text</div>
    </PressResponder>
  );
}
`;

const env = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = "development";
});
afterEach(() => {
  process.env.NODE_ENV = env;
  vi.restoreAllMocks();
});

const warnings = async (view: unknown) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const html = await renderHtml(view as never);
  return { html, calls: warn.mock.calls.filter((c) => String(c[0]).includes("PressResponder")).length };
};

test("SSR: a trigger passed through a wrapper's children slot does not warn", async () => {
  const m = await importModule<Record<string, unknown>>("pressable-server-fixture.tsx", src);
  const wrapped = await warnings(m.Wrapped);
  expect(wrapped.html).toContain("<button");
  expect(wrapped.calls).toBe(0);
  const root = await warnings(m.TriggerThroughRoot);
  expect(root.html).toContain('aria-expanded="false"');
  expect(root.calls).toBe(0);
});

test("SSR: never warns, even without a pressable child (RA: the check is a client effect)", async () => {
  const m = await importModule<Record<string, unknown>>("pressable-server-fixture.tsx", src);
  expect((await warnings(m.NoPressable)).calls).toBe(0);
});
