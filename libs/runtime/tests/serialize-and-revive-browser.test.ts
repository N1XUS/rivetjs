// Decode-side messages of `serializeAndRevive` (Function Bridge T30 review F2) compared with Chromium's: a page whose
// handler captures an unregistered token's provided value, resumed by a `createResume({})` that lists no contexts, fails
// with the message the helper throws for the same capture without `contexts` (tests/serialize-and-revive.test.ts). The
// skew messages are compared in tests/resume-skew-browser.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { importResume, serializeAndRevive } from "@rivetjs/runtime/testing/resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

const DEV = process.execArgv.includes("--conditions=development");
const source = `import { createContext, provide, signal, useContext } from "@rivetjs/reactivity";
const Theme = createContext(null, { id: "fixture.theme" });
function Inner() {
  const theme = useContext(Theme);
  const out = signal("idle");
  return <button class="go" onClick={() => out.set(theme.name)}>{out()}</button>;
}
export function Page() {
  return provide(Theme, { name: "server" }, () => <Inner />);
}
`;

test("Missing resume context: Chromium's decoder and serializeAndRevive throw the same message", async () => {
  const module = "src/page.tsx";
  const server = compileResume(source, "server", module);
  const dom = compileResume(source, "dom", module);
  const mod = await importServer<{ Page: () => never }>(server.code);
  const manifest: ResumeManifest = {
    hash: "1",
    runtime: "/rt.js",
    builtins: "/builtins.js",
    symbols: Object.fromEntries(server.symbols.map((s) => [s.id, "/c/Page.js"])),
  };
  const files: Record<string, Served> = {
    "/": `<!doctype html><html><head></head><body>${await resumableToString(() => mod.Page(), { manifest })}</body></html>`,
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
    "/builtins.js": 'import "/resume-builtins.ts";',
    "/c/Page.js": rewrite(compileSymbolModule(dom.symbols, "/fixture.mjs")),
  };
  if (DEV) files["/dev/off.ts"] = stripTypeScriptTypes(await readFile(new URL("../dev/on.ts", import.meta.url), "utf8"));
  const browser = await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      document.addEventListener("rivet:resume-error", (event) => {
        event.preventDefault();
        const detail = (event as CustomEvent).detail as { message?: string; error?: { message?: string } };
        console.error("resume-error " + (detail?.error?.message ?? detail?.message));
      }),
    );
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.click(".go");
    await page.waitForTimeout(400);
    return { errors, text: await page.textContent(".go") };
  });
  const fx = await importResume<typeof import("./resume/serialize-fixture.tsx")>(new URL("./resume/serialize-fixture.tsx", import.meta.url));
  const ours = await serializeAndRevive(() => fx.Themed()).then(
    () => "",
    (error: Error) => error.message,
  );
  assert.equal(browser.text, "idle", "the handler did not run");
  // The loader's `rivet:resume-error` for the failed dispatch carries the decoder's error.
  assert.ok(ours.startsWith("Missing resume context: fixture.theme"), ours);
  assert.ok(browser.errors.includes("resume-error " + ours), JSON.stringify({ ours, browser: browser.errors }));
});
