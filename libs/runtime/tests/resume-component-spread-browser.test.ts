// Component spread of a forwarding props object on a resumed page (RESUME-BUGS #2, 2026-10-09): `<Child {...button} />`
// where `button = mergeProps(props, …)` forwards live getters. The server resume target used to snapshot the object
// (`Child({ ...button })`), reading every forwarded getter inside the enclosing region's read: the region recorded the
// signal behind `class` and was re-created on its first change (server nodes replaced). Passed as is, the child's own
// sites record it and update in place.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolUrls, symbolChunks } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { mergeProps, splitProps } from "@rivetjs/runtime/props";
function Child(props: { class?: string; label?: string }) {
  return <span class={props.class}>{props.label}</span>;
}
export function Merged(props: { class?: string; label?: string }) {
  const button = mergeProps(props, { title: "t" });
  return <div id="merged"><Child {...button} /></div>;
}
export function Split(props: { class?: string; label?: string; other?: number }) {
  const [, rest] = splitProps(props, ["other"]);
  return <div id="split"><Child {...rest} /></div>;
}
export function Page() {
  const cls = signal("a");
  return <main>
    <button id="go" onClick={() => cls.set(cls() + "b")}>go</button>
    <Merged class={cls()} label="m" />
    <Split class={cls()} label="s" other={1} />
  </main>;
}
`;

test("component spread of a mergeProps / splitProps object updates the child in place", async () => {
  const dom = compileResume(source, "dom", "src/spread.tsx");
  const serverCode = compileResume(source, "server", "src/spread.tsx").code;
  const server = await importServer<{ Page(): ServerValue }>(serverCode);
  const groups = symbolChunks(dom.symbols);
  const manifest: ResumeManifest = {
    hash: "spread",
    runtime: "/rt.js",
    symbols: symbolUrls(dom.symbols),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  Object.assign(files, symbolModules(groups));
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  await withPage({ ...files, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await p.goto("http://rivet.test/");
    await p.evaluate(() => document.querySelectorAll("span").forEach((el) => ((el as unknown as { __kept: boolean }).__kept = true)));
    const state = () =>
      p.evaluate(() => [...document.querySelectorAll("span")].map((el) => [el.className, el.textContent, !!(el as unknown as { __kept?: boolean }).__kept]));
    assert.deepEqual(await state(), [
      ["a", "m", true],
      ["a", "s", true],
    ]);
    await p.click("#go");
    await p.waitForFunction(() => document.querySelector("#merged span")?.className === "ab", null, { timeout: 2000 });
    await p.click("#go");
    await p.waitForFunction(() => document.querySelector("#split span")?.className === "abb", null, { timeout: 2000 });
    assert.deepEqual(await state(), [
      ["abb", "m", true],
      ["abb", "s", true],
    ]);
    assert.deepEqual(errors, []);
  });
});
