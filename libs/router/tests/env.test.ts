// `@rivetjs/router/env` (backend plan T2): `defineEnv` with per-variable and whole-source Standard Schemas (zod 3.25
// implements Standard Schema v1), frozen typed result, one aggregate `EnvError` naming every bad key (never values),
// `process.env` default; a browser graph reaching the module fails the build like `@rivetjs/router/server-only`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { z } from "zod";
import { defineEnv, EnvError, type StandardSchemaV1 } from "../env.ts";
import { rivetRouter } from "../build/vite.ts";
import { withNodeEnv } from "./vite-env.ts";

test("per-variable schemas: typed, frozen, only the declared keys", () => {
  const env = defineEnv(
    { PORT: z.coerce.number().int().default(3000), DATABASE_URL: z.string().url(), DEBUG: z.enum(["0", "1"]).optional() },
    { DATABASE_URL: "postgres://rivet-dev@localhost/app", OTHER: "x" },
  );
  const port: number = env.PORT;
  assert.equal(port, 3000);
  assert.equal(env.DATABASE_URL, "postgres://rivet-dev@localhost/app");
  assert.equal(env.DEBUG, undefined);
  assert.deepEqual(Object.keys(env).sort(), ["DATABASE_URL", "DEBUG", "PORT"]);
  assert.ok(!("OTHER" in env));
  assert.ok(Object.isFrozen(env));
  assert.throws(() => ((env as { PORT: number }).PORT = 1), TypeError);
});

test("aggregate error: every missing / invalid key with its messages, schema order, no values", () => {
  let error: unknown;
  try {
    defineEnv(
      { PORT: z.coerce.number().int().min(1), SECRET: z.string().min(32), DATABASE_URL: z.string().url(), OK: z.string() },
      {
        PORT: "zero-ish",
        SECRET: "hunter2-very-secret",
        OK: "fine",
      },
    );
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof EnvError);
  assert.deepEqual(
    error.issues.map((issue) => issue.key),
    ["PORT", "SECRET", "DATABASE_URL"],
  );
  for (const issue of error.issues) assert.ok(issue.messages.length >= 1, issue.key);
  assert.match(error.message, /^\[rivet:env\] invalid environment variables:\n {2}PORT: .+\n {2}SECRET: .+\n {2}DATABASE_URL: .+$/);
  assert.doesNotMatch(error.message, /hunter2|zero-ish/);
});

test("schema messages that quote the received value are redacted (Valibot style), per variable and whole source", () => {
  const quoting: StandardSchemaV1 = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ issues: [{ message: `Invalid key: Expected 32 characters but received "${String(value)}"`, path: [] }] }),
    },
  };
  const whole: StandardSchemaV1 = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ issues: [{ message: `Invalid: received "${(value as Record<string, string>).TOKEN}"`, path: ["TOKEN"] }] }),
    },
  };
  for (const run of [() => defineEnv({ TOKEN: quoting }, { TOKEN: "sk-live-abc123" }), () => defineEnv(whole, { TOKEN: "sk-live-abc123" })])
    assert.throws(run, (error: EnvError) => {
      assert.doesNotMatch(error.message, /sk-live-abc123/);
      assert.doesNotMatch(JSON.stringify(error.issues), /sk-live-abc123/);
      assert.match(error.message, /TOKEN: .*\[redacted\]/);
      return true;
    });
});

test("whole-source schema (z.object): output frozen, issues grouped by their first path segment", () => {
  const schema = z.object({ HOST: z.string().default("127.0.0.1"), PORT: z.coerce.number() });
  const env = defineEnv(schema, { PORT: "4476" });
  assert.deepEqual({ ...env }, { HOST: "127.0.0.1", PORT: 4476 });
  assert.ok(Object.isFrozen(env));
  const strict = z.object({ A: z.string(), B: z.string().min(3) }).refine(() => false, { message: "whole object" });
  assert.throws(
    () => defineEnv(strict, { B: "x" }),
    (error: EnvError) => {
      assert.deepEqual(
        error.issues.map((issue) => issue.key),
        ["A", "B"],
      );
      return true;
    },
  );
  // A refinement over the whole object (no path): reported as `(env)`.
  assert.throws(
    () => defineEnv(strict, { A: "a", B: "bbb" }),
    (error: EnvError) => (assert.deepEqual(error.issues, [{ key: "(env)", messages: ["whole object"] }]), true),
  );
});

test("default source is process.env; Promise-returning schemas are refused", () => {
  process.env.RIVET_ENV_TEST = "from-process";
  try {
    assert.equal(defineEnv({ RIVET_ENV_TEST: z.string() }).RIVET_ENV_TEST, "from-process");
  } finally {
    delete process.env.RIVET_ENV_TEST;
  }
  const slow: StandardSchemaV1<unknown, string> = { "~standard": { version: 1, vendor: "test", validate: async () => ({ value: "x" }) } };
  assert.throws(() => defineEnv({ SLOW: slow }, {}), /synchronous schemas \(SLOW/);
});

const fixture = new URL("./fixture-env/", import.meta.url).pathname.replace(/\/$/, "");

test("vite build: a component reaching @rivetjs/router/env fails the build (RV3011, like server-only)", async () => {
  await rm(resolve(fixture, "dist"), { recursive: true, force: true });
  try {
    await assert.rejects(
      withNodeEnv("production", () => build({ root: fixture, configFile: false, logLevel: "silent", plugins: [rivetRouter()] })),
      (error: Error) => {
        assert.match(error.message, /RV3011 src\/components\/Banner\.tsx → src\/lib\/config\.ts → @rivetjs\/router\/env(\.ts)? \(server-only\)/);
        return true;
      },
    );
  } finally {
    await rm(resolve(fixture, "dist"), { recursive: true, force: true });
    await rm(resolve(fixture, ".rivet"), { recursive: true, force: true });
  }
});

// FIX2 (r3-testgaps#13): a whole-source schema whose output is not an object.
test("whole-source schema with a non-object output → TypeError", () => {
  assert.throws(
    () =>
      defineEnv(
        z.object({ A: z.string() }).transform(() => "flat"),
        { A: "x" },
      ),
    /schema output must be an object/,
  );
  assert.throws(
    () =>
      defineEnv(
        z.any().transform(() => null),
        {},
      ),
    TypeError,
  );
});
