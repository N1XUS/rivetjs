import { test } from "vitest";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";

type Transform = (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;

// Dev serve has no build walk: the plugin passes module-local verdicts. A component holding keyed state but no handler
// is a boundary (its fields adopt under it, with their props), a props-only component is conditional (a static instance
// ships no record): before, both left dependent parentless records that adopted standalone with `{}` props, so the first
// event re-rendered a static QR code from its defaults and emptied a field bound to the page's signal.
test.skipIf(!hasDerivedModel())("dev serve: module-local boundaries + conditional verdicts", () => {
  const root = resolve("libs/compiler/tests");
  const plugin = rivet({ resume: { modules: [], dev: true, appModules: true } });
  (plugin.configResolved as (this: unknown, config: unknown) => void).call(plugin, { command: "serve", root, build: {} });
  const source = [
    'import { signal } from "@rivetjs/reactivity";',
    "export function Code(props: { value: string }) { return <p>{props.value}</p>; }",
    "export function Field(props: { value: () => string }) { return <input value={props.value()} onInput={() => {}} />; }",
    'export function Page() { const link = signal("a"); return <div><Code value={link()} /><Field value={link} /></div>; }',
    "export function Plain() { return <span>plain</span>; }",
  ].join("\n");
  const ctx = {
    error: (value: { message: string }) => {
      throw Error(value.message);
    },
  };
  const out = (plugin.transform as Transform).call(ctx, source, resolve(root, "dev-verdicts-page.tsx"), { ssr: true })!.code;
  const flags = (name: string) => {
    const m = new RegExp(`_b\\("[^"]*#${name}", (\\d+)`).exec(out);
    return m ? Number(m[1]) : null;
  };
  assert.notEqual(flags("Page"), null, "Page (keyed state, no handler) is a boundary");
  assert.equal(flags("Page")! & 1024, 0, "Page has a change source: not conditional");
  assert.equal(flags("Code")! & 1024, 1024, "Code (props only) is conditional");
  assert.equal(flags("Field")! & 1024, 0, "Field (own handler) is not conditional");
  assert.equal(flags("Plain"), null, "Plain renders nothing interactive: no boundary");
});
