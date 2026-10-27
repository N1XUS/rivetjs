import { test, vi, onTestFinished } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { _trackReads } from "@rivetjs/reactivity/track";
import { z } from "zod";
import {
  autofocus,
  createForm,
  defaultChecked,
  defaultValue,
  defineForm,
  describedBy,
  errorId,
  fieldId,
  fieldIssues,
  formIssues,
  isInvalid,
  issueText,
  lastResult,
  mapSchemaIssues,
  setIssues,
  clearIssues,
  submitCount,
  submitted,
  validating,
} from "../index.ts";
import { issueSignal, runtime, type FormStore } from "../store.ts";
import { check, trigger, validateAll } from "../engine.ts";
import { fakeElement, fd, schema, tick } from "./fixtures.ts";

type Signup = { email?: string; password?: string; confirm?: string; address?: { city?: string } };
const signupSchema = schema<Signup>((input) => [
  ...(!input.email?.includes("@") ? [{ path: ["email"], message: "errors.email" }] : []),
  ...((input.password?.length ?? 0) < 8 ? [{ path: ["password"], message: "errors.min8" }] : []),
  ...(input.password !== input.confirm ? [{ path: ["confirm"], message: "errors.mismatch" }] : []),
]);

test("defineForm validates its name and schema", () => {
  assert.throws(() => defineForm({ name: "bad name", schema: signupSchema }), /name must be/);
  assert.throws(() => defineForm({ name: "x", schema: {} as never }), /Standard Schema/);
  const def = defineForm({ name: "signup", schema: signupSchema });
  assert.equal(Object.isFrozen(def), true);
});

test("store: signals and literals only; records on first use", () => {
  const def = defineForm({ name: "signup", schema: signupSchema });
  const form = createForm(def);
  assert.equal(form.i, "signup");
  for (const path of ["email", "password", "confirm", "address.city", "a", "b", "c", "d", "e", "f"]) {
    isInvalid(form, path as never);
    describedBy(form, path as never);
  }
  assert.throws(() => createForm(def, { id: "1bad" }), /id must start with a letter/);
  // Fine-grained: a field binding subscribes to that field's issue signal only.
  const reads = _trackReads(() => isInvalid(form, "email"));
  assert.deepEqual(reads.signals, [form.f.email]);
});

test("result from a failed no-JS POST: issues shown, echo, autofocus, submitted; other forms ignore it", () => {
  const def = defineForm({ name: "signup", schema: signupSchema });
  const reply = {
    ok: false,
    issues: { password: [{ key: "errors.min8" }], email: [{ key: "errors.taken" }] },
    form: [{ key: "errors.form" }],
    values: { email: "a@b.c", tags: ["x", "y"], agree: "on" },
  };
  const form = createForm(def, { result: { name: "signup", result: reply }, initial: { email: "init@x", address: { city: "Kyiv" } } });
  assert.equal(issueText(form, "email"), "errors.taken");
  assert.equal(
    issueText(form, "password", (issue) => `T(${issue.key})`),
    "T(errors.min8)",
  );
  assert.equal(isInvalid(form, "password"), true);
  assert.equal(isInvalid(form, "confirm"), undefined);
  assert.equal(isInvalid(form), true);
  assert.deepEqual(formIssues(form), [{ key: "errors.form" }]);
  assert.equal(submitted(form), true);
  assert.equal(submitCount(form), 1);
  assert.equal(defaultValue(form, "email"), "a@b.c"); // echo wins over initial
  assert.equal(defaultValue(form, "address.city"), "Kyiv"); // not echoed (excluded / not submitted): initial
  assert.equal(defaultChecked(form, "agree" as never), true);
  assert.equal(defaultChecked(form, "tags" as never, "y"), true);
  assert.equal(defaultChecked(form, "tags" as never, "z"), false);
  // First invalid field in issue order (the page renders `autoFocus`).
  assert.equal(autofocus(form, "password"), true);
  assert.equal(autofocus(form, "email"), undefined);
  assert.equal(describedBy(form, "email", { description: true }), "signup-email-desc signup-email-error");
  assert.equal(describedBy(form, "confirm"), undefined);
  assert.equal(fieldId(form, "address.city"), "signup-address-city");
  assert.equal(errorId(form, "email"), "signup-email-error");
  assert.deepEqual(
    fieldIssues(form).map(([path]) => path),
    ["password", "email"],
  );
  // Another instance (`_form` id) or another action leaves a form untouched.
  const other = createForm(def, { id: "second", result: { name: "signup", result: { ...reply, id: "signup" } } });
  assert.equal(isInvalid(other), undefined);
  assert.equal(isInvalid(createForm(def, { result: { name: "login", result: reply } })), undefined);
  // Without an echo, initial values render.
  const fresh = createForm(def, { initial: { email: "init@x", address: { city: "Kyiv" } } });
  assert.equal(defaultValue(fresh, "address.city"), "Kyiv");
  const ok = createForm(def, { result: { name: "signup", result: { ok: true, data: { id: 7 } } } });
  assert.deepEqual(lastResult(ok), { id: 7 });
});

test("setIssues / clearIssues: server-driven errors, form level via empty path", () => {
  const form = createForm(defineForm({ name: "f", schema: signupSchema }));
  setIssues(form, { email: "errors.taken", "": ["errors.down"], password: [{ key: "errors.min", params: { min: 8 } }] });
  assert.equal(issueText(form, "email"), "errors.taken");
  assert.deepEqual(formIssues(form), [{ key: "errors.down" }]);
  assert.deepEqual(untrack(form.f.password!), [{ key: "errors.min", params: { min: 8 } }]);
  clearIssues(form, "email");
  assert.equal(isInvalid(form, "email"), undefined);
  clearIssues(form);
  assert.equal(isInvalid(form), undefined);
});

const data = (values: Record<string, string>) => () => fd(Object.entries(values));
test("timing: validateOn blur, revalidateOn input; cross-field dependents update once armed", () => {
  const def = defineForm({ name: "f", schema: signupSchema, validateOn: "blur" });
  const form = createForm(def);
  // Typing in a pristine field does not validate.
  trigger(def, form, fakeElement, "email", "input", data({ email: "a" }));
  assert.equal(isInvalid(form, "email"), undefined);
  // Blur validates and arms it; other (unarmed) fields stay quiet.
  trigger(def, form, fakeElement, "email", "blur", data({ email: "a" }));
  assert.equal(issueText(form, "email"), "errors.email");
  assert.equal(isInvalid(form, "password"), undefined);
  // Armed: typing revalidates.
  trigger(def, form, fakeElement, "email", "input", data({ email: "a@b" }));
  assert.equal(isInvalid(form, "email"), undefined);
  // Cross-field: confirm armed; a password change re-runs the schema and updates confirm.
  trigger(def, form, fakeElement, "confirm", "blur", data({ email: "a@b", password: "12345678", confirm: "1234567" }));
  assert.equal(issueText(form, "confirm"), "errors.mismatch");
  trigger(def, form, fakeElement, "password", "input", data({ email: "a@b", password: "1234567", confirm: "1234567" }));
  assert.equal(isInvalid(form, "confirm"), undefined);
  // Password itself was never armed: its issue stays hidden until blur or submit.
  assert.equal(isInvalid(form, "password"), undefined);
});

test("timing matrix: validateOn × revalidateOn", () => {
  const cases: [
    validateOn: "submit" | "blur" | "input" | "change",
    revalidateOn: "input" | "blur" | "submit",
    events: ("input" | "change" | "blur")[],
    shown: boolean[],
  ][] = [
    ["submit", "input", ["input", "change", "blur"], [false, false, false]],
    ["input", "input", ["input"], [true]],
    ["change", "input", ["input", "change"], [false, true]],
    ["blur", "blur", ["blur", "input", "blur"], [true, true, true]],
    ["input", "submit", ["input", "input"], [true, true]],
  ];
  for (const [validateOn, revalidateOn, events, shown] of cases) {
    const def = defineForm({ name: "f", schema: signupSchema, validateOn, revalidateOn });
    const form = createForm(def);
    events.forEach((kind, i) => {
      trigger(def, form, fakeElement, "email", kind, data({ email: "bad" }));
      assert.equal(isInvalid(form, "email") === true, shown[i], `${validateOn}/${revalidateOn} #${i} ${kind}`);
    });
  }
  // revalidateOn submit: an armed field keeps its issue while typing a fix.
  const def = defineForm({ name: "f", schema: signupSchema, validateOn: "blur", revalidateOn: "submit" });
  const form = createForm(def);
  trigger(def, form, fakeElement, "email", "blur", data({ email: "bad" }));
  trigger(def, form, fakeElement, "email", "input", data({ email: "ok@x" }));
  assert.equal(isInvalid(form, "email"), true);
});

test("validateAll: arms every invalid field, returns output; async schemas drop stale results", async () => {
  const def = defineForm({ name: "f", schema: signupSchema });
  const form = createForm(def);
  const bad = await validateAll(def, form, fakeElement, fd([["email", "x"]]));
  assert.equal(bad.ok, false);
  assert.deepEqual(
    fieldIssues(form).map(([p]) => p),
    ["email", "password"],
  );
  const good = await validateAll(
    def,
    form,
    fakeElement,
    fd([
      ["email", "a@b"],
      ["password", "12345678"],
      ["confirm", "12345678"],
    ]),
  );
  assert.deepEqual(good, { ok: true, value: { email: "a@b", password: "12345678", confirm: "12345678" } });
  assert.equal(isInvalid(form), undefined);
  // Root issues → form issues.
  const rootDef = defineForm({ name: "r", schema: schema(() => [{ message: "errors.root" }]) });
  const rootForm = createForm(rootDef);
  assert.equal((await validateAll(rootDef, rootForm, fakeElement, fd([]))).ok, false);
  assert.deepEqual(formIssues(rootForm), [{ key: "errors.root" }]);
  // Async schema: validating bit while pending; the latest run wins.
  const asyncDef = defineForm({
    name: "a",
    schema: schema<Signup>((i) => (i.email === "bad" ? [{ path: ["email"], message: "errors.email" }] : []), { async: true }),
    validateOn: "input",
  });
  const asyncForm = createForm(asyncDef);
  trigger(asyncDef, asyncForm, fakeElement, "email", "input", data({ email: "bad" }));
  assert.equal(validating(asyncForm), true);
  trigger(asyncDef, asyncForm, fakeElement, "email", "input", data({ email: "good" }));
  await tick();
  assert.equal(validating(asyncForm), false);
  assert.equal(isInvalid(asyncForm, "email"), undefined);
});

test("async event schema rejections become field issues, clear busy state, and recover", async () => {
  for (const kind of ["input", "blur"] as const) {
    const def = defineForm({
      name: "f",
      validateOn: kind,
      schema: schema<Signup>(
        (input) => {
          if (input.email === "bad") throw new Error("validation unavailable");
          return [];
        },
        { async: true },
      ),
    });
    const form = createForm(def);
    trigger(def, form, fakeElement, "email", kind, data({ email: "bad" }));
    assert.equal(validating(form), true);
    await tick();
    assert.equal(validating(form), false);
    assert.deepEqual(fieldIssues(form), [["email", [{ key: "errors.check", message: "validation unavailable" }]]]);
    trigger(def, form, fakeElement, "email", "input", data({ email: "good" }));
    await tick();
    assert.deepEqual(fieldIssues(form), []);
  }
});

test("a superseded async schema rejection cannot replace newer validation", async () => {
  let reject!: (error: Error) => void;
  const def = defineForm({
    name: "f",
    validateOn: "input",
    schema: {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (input: unknown) =>
          (input as Signup).email === "bad"
            ? new Promise<never>((_, fail) => {
                reject = fail;
              })
            : { value: input },
      },
    },
  });
  const form = createForm(def);
  trigger(def, form, fakeElement, "email", "input", data({ email: "bad" }));
  trigger(def, form, fakeElement, "email", "input", data({ email: "good" }));
  reject(new Error("stale"));
  await tick();
  assert.equal(validating(form), false);
  assert.deepEqual(fieldIssues(form), []);
});

test("field checks: debounced, abortable, merged after schema issues, awaited by submit with timeout", async () => {
  // Mocked setTimeout (engine debounce/timeout and the checks' own tick): deterministic under load.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => void vi.useRealTimers());
  const advance = async (ms: number) => {
    for (let i = 0; i < ms; i++) {
      vi.advanceTimersByTime(1);
      await new Promise((done) => setImmediate(done));
    }
  };
  const calls: string[] = [];
  const aborted: string[] = [];
  const def = defineForm({
    name: "f",
    schema: schema<{ email?: string }>((i) => (!i.email ? [{ path: ["email"], message: "errors.required" }] : [])),
    validateOn: "input",
    fields: {
      email: {
        debounce: 20,
        validate: async (value, { signal }) => {
          calls.push(String(value));
          signal.addEventListener("abort", () => aborted.push(String(value)));
          await tick(10);
          return value === "taken@x" ? "errors.taken" : undefined;
        },
      },
    },
  });
  const form = createForm(def);
  trigger(def, form, fakeElement, "email", "input", data({ email: "t" }));
  trigger(def, form, fakeElement, "email", "input", data({ email: "taken@x" }));
  assert.deepEqual(calls, []); // debounced
  await advance(19);
  assert.deepEqual(calls, []);
  await advance(6);
  assert.deepEqual(calls, ["taken@x"]);
  assert.equal(validating(form, "email"), true);
  // New input while the check runs aborts it.
  trigger(def, form, fakeElement, "email", "input", data({ email: "taken@x" }));
  await advance(5);
  assert.deepEqual(aborted, ["taken@x"]);
  await advance(40);
  assert.equal(issueText(form, "email"), "errors.taken");
  assert.equal(validating(form, "email"), false);
  // A schema issue for the path skips (and clears) the check.
  trigger(def, form, fakeElement, "email", "input", data({ email: "" }));
  assert.equal(issueText(form, "email"), "errors.required");
  // Submit awaits checks immediately (no debounce).
  const before = calls.length;
  const submitting = validateAll(def, form, fakeElement, fd([["email", "taken@x"]]));
  await advance(10);
  const result = await submitting;
  assert.equal(calls.length, before + 1);
  assert.equal(result.ok, false);
  assert.equal(issueText(form, "email"), "errors.taken");
  // Timeout → form issue.
  const slow = defineForm({ name: "s", schema: schema(() => []), asyncTimeout: 15, fields: { email: { validate: () => tick(100).then(() => undefined) } } });
  const slowForm = createForm(slow);
  const timingOut = validateAll(slow, slowForm, fakeElement, fd([["email", "x"]]));
  await advance(15);
  assert.equal((await timingOut).ok, false);
  assert.deepEqual(formIssues(slowForm), [{ key: "errors.timeout" }]);
  // Paths without a configured check: none scheduled.
  assert.equal(check(def, form, fakeElement, "other", {}), undefined);
  runtime(slowForm).aborts.forEach((c) => c.abort());
});

test("issue mapping: zod paths (nested, arrays, refinements) and root issues", async () => {
  const zodSchema = z
    .object({
      email: z.string().email("errors.email"),
      items: z.array(z.object({ qty: z.number().min(1, "errors.qty") })),
      address: z.object({ city: z.string().min(1, "errors.city") }),
      password: z.string(),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "errors.mismatch", path: ["confirm"] });
  const result = await zodSchema["~standard"].validate({ email: "x", items: [{ qty: 1 }, { qty: 0 }], address: { city: "" }, password: "a", confirm: "a" });
  assert.deepEqual(mapSchemaIssues(result.issues), {
    fields: { email: [{ key: "errors.email" }], "items.1.qty": [{ key: "errors.qty" }], "address.city": [{ key: "errors.city" }] },
    form: [],
  });
  const mismatch = await zodSchema["~standard"].validate({ email: "a@b.co", items: [], address: { city: "K" }, password: "a", confirm: "b" });
  assert.deepEqual(mapSchemaIssues(mismatch.issues).fields, { confirm: [{ key: "errors.mismatch" }] });
  assert.deepEqual(mapSchemaIssues([{ message: "root" }, { message: "seg", path: [{ key: "a" }, 0] }]), {
    fields: { "a.0": [{ key: "seg" }] },
    form: [{ key: "root" }],
  });
  // Through a definition: coercion feeds zod numbers.
  const def = defineForm({ name: "z", schema: zodSchema, coerce: { "items.$.qty": "number" } });
  const form = createForm(def);
  const outcome = await validateAll(
    def,
    form,
    fakeElement,
    fd([
      ["email", "a@b.co"],
      ["items.0.qty", "0"],
      ["address.city", "K"],
      ["password", "p"],
      ["confirm", "p"],
    ]),
  );
  assert.equal(outcome.ok, false);
  assert.equal(issueText(form, "items.0.qty"), "errors.qty");
});

test("records are created lazily and the store type is generic", () => {
  const form = createForm(defineForm({ name: "f", schema: signupSchema })) as FormStore<Signup>;
  assert.equal(Object.keys(form.f).length, 0);
  issueSignal(form, "email");
  assert.deepEqual(Object.keys(form.f), ["email"]);
});
