// T3 errors: a throwing / rejecting island render → the nearest Rivet ErrorBoundary; without one the island's
// `fallback`; else the error propagates as RV2144 naming the framework and the island (cause kept).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { page } from "./harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Page = (props?: Record<string, unknown>) => ServerValue;

const source = `
import { ErrorBoundary } from "@rivetjs/runtime/server";
import { _island } from "@rivetjs/bridge/server";
import { fake, Broken as BrokenImpl, Later as LaterImpl } from "./fake-adapter.ts";
const BROKEN = { id: "src/Broken.fake#default", c: BrokenImpl, a: fake };
const LATER = { id: "src/Later.fake#default", c: LaterImpl, a: fake };
export function Broken(props) { return <>{_island(props, BROKEN)}</>; }
export function Later(props) { return <>{_island(props, LATER)}</>; }
export function Bounded({ late }) {
  return <main><ErrorBoundary fallback={(error) => <p>caught: {String(error.message)}</p>}>{() => (late ? <Later fail={true} /> : <Broken />)}</ErrorBoundary></main>;
}
export function WithFallback({ late }) {
  return <main>{late ? <Later fail={true} fallback={<i>static fallback</i>} /> : <Broken fallback={<i>static fallback</i>} />}</main>;
}
export function Bare({ late }) {
  return <main>{late ? <Later fail={true} /> : <Broken />}</main>;
}
`;
const { mod, manifest } = await page<Record<string, Page>>(source);
const render = async (fn: Page, late: boolean) => (await resumableToString(() => fn({ late }), { manifest })) as string;

for (const late of [false, true]) {
  const kind = late ? "async rejection" : "sync throw";
  test(`${kind}: the nearest ErrorBoundary renders its fallback with the RV2144 error`, async () => {
    const html = await render(mod.Bounded!, late);
    assert.match(
      html,
      new RegExp(
        `<p>caught: (<!--\\[-->)?\\[rivet:bridge\\] RV2144 fake island src/(Broken|Later)\\.fake#default failed to render: ${late ? "late boom" : "boom"}(<!--\\]-->)?</p>`,
      ),
    );
    assert.doesNotMatch(html, /rivet-island/);
  });
  test(`${kind}: no boundary, a fallback prop → the fallback in a static island root`, async () => {
    assert.match(
      await render(mod.WithFallback!, late),
      /<main><rivet-island data-ri="i\d+" style="display:contents"><i>static fallback<\/i><\/rivet-island><\/main>/,
    );
  });
  test(`${kind}: neither → the render fails with RV2144 (cause kept)`, async () => {
    await assert.rejects(render(mod.Bare!, late), (error: Error) => {
      assert.match(error.message, /^\[rivet:bridge\] RV2144 fake island src\/(Broken|Later)\.fake#default failed to render: (late )?boom/);
      assert.equal((error.cause as Error).message, late ? "late boom" : "boom");
      return true;
    });
  });
}
