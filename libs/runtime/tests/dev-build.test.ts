// Development builds (`--conditions=development`, Vite dev) add diagnostics; the default resolution
// is the production build and carries none of their code.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createEncoder } from "../resume-format.ts";

const encodeIn = (conditions: string[]) =>
  execFileSync(
    process.execPath,
    [
      ...conditions,
      "--input-type=module",
      "-e",
      `import { createEncoder } from ${JSON.stringify(new URL("../resume-format.ts", import.meta.url).href)};
       try { createEncoder().ref({ items: [1, 2, { title: "x", onClick() {} }] }); } catch (error) { console.log(error.message); }`,
    ],
    { encoding: "utf8" },
  ).trim();

test("development: serialization errors name the value path", () => {
  assert.match(encodeIn(["--conditions=development"]), /^\.items\[2\]\.onClick: function is not serializable — only data resumes/);
  assert.equal(encodeIn([]), "function is not serializable: pass data, create functions in the component that uses them");
});

test("development: paths cover maps, sets and quoted keys", () => {
  const out = execFileSync(
    process.execPath,
    [
      "--conditions=development",
      "--input-type=module",
      "-e",
      `import { createEncoder } from ${JSON.stringify(new URL("../resume-format.ts", import.meta.url).href)};
       const run = (v) => { try { createEncoder().ref(v); } catch (error) { console.log(error.message); } };
       run({ "a-b": new Map([["k", Symbol("s")]]) });
       run([new Set([() => {}])]);`,
    ],
    { encoding: "utf8" },
  ).trim();
  const [symbol, fn] = out.split("\n");
  assert.equal(symbol, '["a-b"].get("k"): symbol is not serializable');
  assert.match(fn!, /^\[0\]\.values\(\)\[0\]: function is not serializable — /);
});

test("development hints name the cause and the fix", async () => {
  const { DEV } = await import("../dev/on.ts");
  assert.match(DEV.hint("Missing resumable element 3", "drift"), /^Missing resumable element 3 — the HTML changed between the server render and resume/);
  assert.match(DEV.hint("Resume table entry `t` needs @rivetjs/runtime/resume-builtins (not loaded)", "manifest"), /rivet-resume\.json/);
  assert.match(DEV.hint("boundary App did not adopt", "adopt"), /rendered afresh in the browser/);
});

test("production (default resolution): short messages", () => {
  assert.throws(() => createEncoder().ref({ a: [() => {}] }), {
    message: "function is not serializable: pass data, create functions in the component that uses them",
  });
});

test("production bundle (vite build) carries no development code", async () => {
  const { build } = await import("vite");
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    root: new URL("..", import.meta.url).pathname,
    build: { write: false, minify: true, lib: { entry: "resume-format.ts", formats: ["es"], fileName: "format" } },
  })) as { output: { code?: string }[] }[];
  const code = result[0]!.output[0]!.code!;
  assert.match(code, /is not serializable/);
  assert.doesNotMatch(code, /values\(\)\[|\.keys\(\)\[|WeakMap/);
});
