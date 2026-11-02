// A streamed Async content that fails on the server stays silent in production (the browser renders it); in dev the cause is logged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Async } from "@rivetjs/runtime/server";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import { DEV } from "#dev";

test("a streamed Async content that throws warns with its cause in dev only", async () => {
  const warn = console.warn,
    warned: unknown[][] = [],
    cause = new Error("content failed");
  console.warn = (...args: unknown[]) => void warned.push(args);
  try {
    await renderResumable(
      () =>
        Async({
          load: () => Promise.resolve("value"),
          fallback: () => "pending",
          children: () => {
            throw cause;
          },
        }),
      { write: () => {} },
      { stream: {} },
    );
  } finally {
    console.warn = warn;
  }
  assert.equal(
    warned.some((args) => args.includes(cause)),
    !!DEV,
  );
});
