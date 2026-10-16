// Custom submit (`defineForm({ submit })`): submitting state, success data, returned and thrown
// failures, abort on resubmit, public `focusFirstInvalid`. Browser + resumed flow: app.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import {
  createForm,
  defineForm,
  fieldIssues,
  setIssues,
  formIssues,
  focusFirstInvalid,
  isInvalid,
  lastResult,
  submitting,
  type SubmitContext,
} from "../index.ts";
import { send } from "../submit.ts";
import { runtime } from "../store.ts";
import { encodeState, fakeElement, fd, schema, tick } from "./fixtures.ts";

type Contact = { email: string; message: string };
const contactSchema = schema<Contact>(() => []);

test("success: submitting() while the handler runs, typed value + FormData + signal, lastResult = data", async () => {
  let seen: { value: Contact; context: SubmitContext<Contact> } | undefined;
  let finish!: (value: unknown) => void;
  const def = defineForm({
    name: "contact",
    schema: contactSchema,
    submit: (value, context) => {
      seen = { value, context };
      return new Promise((done) => (finish = done));
    },
  });
  const form = createForm(def);
  const data = fd([
    ["email", "a@b.c"],
    ["message", "hi"],
  ]);
  const running = send(def, form, fakeElement, data, { email: "a@b.c", message: "hi" }, null);
  assert.equal(
    untrack(() => submitting(form)),
    true,
  );
  assert.deepEqual(seen!.value, { email: "a@b.c", message: "hi" });
  assert.equal(seen!.context.formData, data);
  assert.equal(seen!.context.element, fakeElement);
  assert.equal(seen!.context.form, form);
  assert.equal(seen!.context.signal.aborted, false);
  finish({ ok: true, data: { id: 7 } });
  await running;
  assert.equal(
    untrack(() => submitting(form)),
    false,
  );
  assert.deepEqual(
    untrack(() => lastResult(form)),
    { id: 7 },
  );
  // Any other return value is the result data itself.
  const plain = defineForm({ name: "plain", schema: contactSchema, submit: async () => "sent" });
  const other = createForm(plain);
  await send(plain, other, fakeElement, fd([]), {}, null);
  assert.equal(
    untrack(() => lastResult(other)),
    "sent",
  );
  // The store stays resume-serializable after a custom submit.
  assert.doesNotThrow(() => encodeState(other));
});

test("returned failure: field + form issues shown (IssueLike accepted), fields armed, stale issues cleared", async () => {
  const def = defineForm({
    name: "contact",
    schema: contactSchema,
    focusOnInvalid: false,
    submit: async () => ({ ok: false, issues: { email: "That address bounced", message: [{ key: "errors.spam" }] }, form: "Try again later" }),
  });
  const form = createForm(def);
  setIssues(form, { old: "stale" } as never);
  await send(def, form, fakeElement, fd([]), {}, null);
  assert.deepEqual(
    untrack(() => fieldIssues(form)),
    [
      ["email", [{ key: "That address bounced" }]],
      ["message", [{ key: "errors.spam" }]],
    ],
  );
  assert.deepEqual(
    untrack(() => formIssues(form)),
    [{ key: "Try again later" }],
  );
  assert.equal(
    untrack(() => isInvalid(form, "email")),
    true,
  );
  assert.equal(runtime(form).armed.has("email"), true);
  assert.equal(
    untrack(() => submitting(form)),
    false,
  );
  assert.equal(
    untrack(() => lastResult(form)),
    undefined,
  );
});

test("thrown error → form issue errors.submit with the message", async () => {
  const def = defineForm({
    name: "contact",
    schema: contactSchema,
    submit: async () => {
      throw new Error("Service unavailable");
    },
  });
  const form = createForm(def);
  await send(def, form, fakeElement, fd([]), {}, null);
  assert.deepEqual(
    untrack(() => formIssues(form)),
    [{ key: "errors.submit", message: "Service unavailable" }],
  );
  assert.equal(
    untrack(() => submitting(form)),
    false,
  );
});

test("resubmit aborts the previous submit; its late result is ignored and submitting stays on", async () => {
  const signals: AbortSignal[] = [];
  const finishers: ((value: unknown) => void)[] = [];
  const def = defineForm({
    name: "contact",
    schema: contactSchema,
    submit: (_value, { signal }) => {
      signals.push(signal);
      return new Promise((done) => finishers.push(done));
    },
  });
  const form = createForm(def);
  const first = send(def, form, fakeElement, fd([]), {}, null);
  const second = send(def, form, fakeElement, fd([]), {}, null);
  assert.equal(signals[0]!.aborted, true);
  assert.equal(signals[1]!.aborted, false);
  finishers[0]!({ ok: true, data: "first" });
  await first;
  await tick();
  assert.equal(
    untrack(() => submitting(form)),
    true,
    "second still running",
  );
  assert.equal(
    untrack(() => lastResult(form)),
    undefined,
  );
  finishers[1]!({ ok: true, data: "second" });
  await second;
  assert.equal(
    untrack(() => submitting(form)),
    false,
  );
  assert.equal(
    untrack(() => lastResult(form)),
    "second",
  );
});

test("focusFirstInvalid(form) is public: no element (server, detached) → false", () => {
  const def = defineForm({ name: "contact", schema: contactSchema });
  assert.equal(focusFirstInvalid(createForm(def)), false);
});
