// Function Bridge T19 (Q6): render-time capture errors name the capture in dev (manifest names), no index in prod.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";

const DEV_RUN = process.execArgv.includes("--conditions=development");
const manifest = { runtime: "/rt.js", symbols: { "t.tsx#T$fx": "/c.js" }, captures: { "t.tsx#T$fx": ["count", "token"] } };

test("an unserializable capture is named by the dev manifest", async () => {
  await assert.rejects(
    async () => resumableToString(() => (_rEffect("t.tsx#T$fx", [1, Symbol("x")]), "x" as never), { manifest }),
    (error: Error) => {
      assert.match(error.message, /^Cannot resume t\.tsx#T\$fx: /);
      if (DEV_RUN) assert.match(error.message, /capture `token`/);
      else assert.doesNotMatch(error.message, /capture #|`token`/);
      return true;
    },
  );
});

test("without manifest names, dev falls back to the capture index", async () => {
  await assert.rejects(
    async () =>
      resumableToString(() => (_rEffect("t.tsx#T$fx", [1, Symbol("x")]), "x" as never), { manifest: { runtime: "/rt.js", symbols: manifest.symbols } }),
    (error: Error) => {
      assert.match(error.message, /^Cannot resume t\.tsx#T\$fx: /);
      if (DEV_RUN) assert.match(error.message, /capture #1 /);
      else assert.doesNotMatch(error.message, /capture #/);
      return true;
    },
  );
});
