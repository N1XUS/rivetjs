// Browser tests for text-field.ts. Ported from angular/components
// src/cdk/text-field/{autosize,autofill}.spec.ts (MIT, © Google LLC).
import { describe, it, afterAll as after, beforeAll as before } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { harness, type Harness } from "./harness.ts";

let h: Harness;
let page: Page;
before(async () => {
  h = await harness();
  page = await h.blank();
});
after(() => h.close());

const POEM = `
    Once upon a midnight dreary, while I pondered, weak and weary,
    Over many a quaint and curious volume of forgotten lore—
        While I nodded, nearly napping, suddenly there came a tapping,
    As of some one gently rapping, rapping at my chamber door.
    “’Tis some visitor,” I muttered, “tapping at my chamber door—
                Only this and nothing more.”`;
const LINES = `
      Line
      Line
      Line
      Line
      Line`;

/**
 * Runs `body` with `textarea` (in a fresh fixture: padding / border reset, like the original
 * `textareaStyleReset`), the module and helpers. `content` / `options` are the fixture inputs.
 */
function withTextarea<T>(
  body: string,
  setup: { content?: string; placeholder?: string; attach?: boolean; options?: Record<string, unknown> } = {},
): Promise<T> {
  return page.evaluate(
    async ({ body, setup }) => {
      document.body.innerHTML = '<style>textarea{padding:0;border:none;overflow:auto;width:200px}</style><div id="root"></div>';
      const mod = await import("/text-field/autosize.ts");
      const textarea = document.createElement("textarea");
      textarea.textContent = setup.content ?? "";
      if (setup.placeholder) textarea.placeholder = setup.placeholder;
      document.getElementById("root")!.append(textarea);
      const autosize = setup.attach === false ? undefined : mod.autosizeTextarea(textarea, setup.options ?? {});
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const fn = new Function("textarea", "autosize", "mod", "wait", `return (async () => { ${body} })()`);
      const result = await fn(textarea, autosize, mod, wait);
      autosize?.destroy();
      return result;
    },
    { body, setup },
  ) as Promise<T>;
}

describe("CdkTextareaAutosize (autosizeTextarea)", () => {
  it("should resize the textarea based on its content", async () => {
    const r = await withTextarea<boolean[]>(
      `const results = [];
       let previousHeight = textarea.clientHeight;
       textarea.value = ${JSON.stringify(POEM)};
       autosize.resizeToFitContent();
       results.push(textarea.clientHeight > previousHeight, textarea.clientHeight === textarea.scrollHeight);
       previousHeight = textarea.clientHeight;
       textarea.value += ${JSON.stringify(POEM)};
       autosize.resizeToFitContent();
       results.push(textarea.clientHeight > previousHeight, textarea.clientHeight === textarea.scrollHeight);
       return results;`,
    );
    assert.deepEqual(r, [true, true, true, true]);
  });

  it("should keep the placeholder size if the value is shorter than the placeholder", async () => {
    const r = await withTextarea<boolean[]>(
      `const fits = textarea.clientHeight === textarea.scrollHeight;
       const previousHeight = textarea.clientHeight;
       textarea.value = "a";
       autosize.resizeToFitContent();
       return [fits, textarea.clientHeight === previousHeight, previousHeight > 30];`,
      { options: { placeholder: POEM } },
    );
    assert.deepEqual(r, [true, true, true]);
  });

  it("should set a min-height based on minRows", async () => {
    const r = await withTextarea<[string, number, number]>(
      `const before = textarea.style.minHeight;
       autosize.setMinRows(4);
       const four = parseInt(textarea.style.minHeight);
       autosize.setMinRows(6);
       return [before, four, parseInt(textarea.style.minHeight)];`,
    );
    assert.equal(r[0], "");
    assert.ok(r[1] > 0);
    assert.ok(r[2] > r[1]);
  });

  it("should set a max-height based on maxRows", async () => {
    const r = await withTextarea<[string, number, number]>(
      `const before = textarea.style.maxHeight;
       autosize.setMaxRows(4);
       const four = parseInt(textarea.style.maxHeight);
       autosize.setMaxRows(6);
       return [before, four, parseInt(textarea.style.maxHeight)];`,
    );
    assert.equal(r[0], "");
    assert.ok(r[1] > 0);
    assert.ok(r[2] > r[1]);
  });

  it("should reduce textarea height when minHeight decreases", async () => {
    const r = await withTextarea<[number, number]>(
      `autosize.setMinRows(6);
       const six = parseInt(textarea.style.height);
       autosize.setMinRows(3);
       return [six, parseInt(textarea.style.height)];`,
    );
    assert.ok(r[1] < r[0], `${r[1]} < ${r[0]}`);
  });

  it("should export the cdkAutosize reference (textareaAutosize)", async () => {
    const r = await withTextarea<boolean>(`return mod.textareaAutosize(textarea) === autosize && typeof autosize.resizeToFitContent === "function";`);
    assert.equal(r, true);
  });

  it("should initially set the rows of a textarea to one", async () => {
    const r = await withTextarea<[number, number, number, boolean, boolean]>(
      `const initial = textarea.rows;
       autosize.setMinRows(1);
       const one = textarea.rows;
       const previousMinHeight = parseInt(textarea.style.minHeight);
       autosize.setMinRows(2);
       return [initial, one, textarea.rows, parseInt(textarea.style.minHeight) > previousMinHeight, textarea.classList.contains("cdk-textarea-autosize")];`,
    );
    assert.deepEqual(r, [1, 1, 1, true, true]);
  });

  it("should calculate the proper height based on the specified amount of max rows", async () => {
    const r = await withTextarea<boolean[]>(
      `textarea.value = [1, 2, 3, 4, 5, 6, 7, 8].join("\\n");
       autosize.resizeToFitContent();
       const noScrollbar = textarea.clientHeight === textarea.scrollHeight;
       autosize.setMaxRows(5);
       return [noScrollbar, textarea.clientHeight < textarea.scrollHeight];`,
    );
    assert.deepEqual(r, [true, true]);
  });

  it("should properly resize to content on init", async () => {
    const r = await withTextarea<boolean>(`return textarea.clientHeight === textarea.scrollHeight && textarea.clientHeight > 40;`, { content: LINES });
    assert.equal(r, true);
  });

  it("should properly resize to placeholder on init", async () => {
    const r = await withTextarea<boolean>(`return textarea.clientHeight === textarea.scrollHeight && textarea.clientHeight > 40;`, {
      options: { placeholder: LINES },
    });
    assert.equal(r, true);
  });

  it("should resize when the textarea value is changed programmatically (form / signal binding)", async () => {
    const r = await withTextarea<boolean>(
      `const previousHeight = textarea.clientHeight;
       textarea.value = "\\n      How much wood would a woodchuck chuck\\n      if a woodchuck could chuck wood?\\n    ";
       return textarea.clientHeight > previousHeight;`,
    );
    assert.equal(r, true);
  });

  it("resizes on user input", async () => {
    await page.evaluate(async () => {
      document.body.innerHTML = '<style>textarea{padding:0;border:none;overflow:auto;width:200px}</style><textarea id="t"></textarea>';
      const { autosizeTextarea } = await import("/text-field/autosize.ts");
      autosizeTextarea(document.getElementById("t") as HTMLTextAreaElement);
    });
    await page.focus("#t");
    const before = await page.evaluate(() => document.getElementById("t")!.clientHeight);
    await page.keyboard.type("a\nb\nc\nd\n");
    const afterHeight = await page.evaluate(async () => {
      const { textareaAutosize } = await import("/text-field/autosize.ts");
      const t = document.getElementById("t") as HTMLTextAreaElement;
      const height = t.clientHeight;
      textareaAutosize(t)!.destroy();
      return height;
    });
    assert.ok(afterHeight > before, `${afterHeight} > ${before}`);
  });

  it("should trigger a resize when the window is resized", async () => {
    const r = await withTextarea<number>(
      `let calls = 0;
       const original = autosize.resizeToFitContent;
       autosize.resizeToFitContent = (force) => { calls++; original(force); };
       window.dispatchEvent(new Event("resize"));
       await wait(100);
       return calls;`,
    );
    assert.ok(r >= 1);
  });

  it("should not trigger a resize when it is disabled", async () => {
    const r = await withTextarea<boolean[]>(
      `const previousHeight = textarea.clientHeight;
       const results = [textarea.clientHeight === previousHeight, textarea.clientHeight < textarea.scrollHeight];
       autosize.setEnabled(true);
       results.push(textarea.clientHeight > previousHeight, textarea.clientHeight === textarea.scrollHeight);
       autosize.setEnabled(false);
       results.push(textarea.clientHeight === previousHeight, textarea.clientHeight < textarea.scrollHeight);
       return results;`,
      { content: LINES, options: { enabled: false } },
    );
    assert.deepEqual(r, [true, true, true, true, true, true]);
  });

  it("should handle an undefined placeholder", async () => {
    const r = await withTextarea<boolean>(`autosize.setPlaceholder(undefined); return textarea.hasAttribute("placeholder");`, { placeholder: "x" });
    assert.equal(r, false);
  });

  it("destroy() restores the native value property and removes listeners", async () => {
    const r = await withTextarea<boolean[]>(
      `autosize.destroy();
       const own = Object.prototype.hasOwnProperty.call(textarea, "value");
       const height = textarea.style.height;
       textarea.value = ${JSON.stringify(POEM)};
       return [own, textarea.style.height === height, mod.textareaAutosize(textarea) === undefined];`,
    );
    assert.deepEqual(r, [false, true, true]);
  });

  it("autosizeProps: native field-sizing path (zero JS) with min / max rows", async () => {
    const r = await page.evaluate(async () => {
      const { autosizeProps } = await import("/text-field/autosize.ts");
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/text-field/text-field.css";
      document.head.append(link);
      await new Promise((r) => (link.onload = r));
      const props = autosizeProps({ minRows: 2, maxRows: 4, native: true });
      document.body.innerHTML = `<textarea class="${props.class}" rows="1" style="${Object.entries(props.style!)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")};padding:0;border:none;width:200px;line-height:20px"></textarea>`;
      const t = document.querySelector("textarea")!;
      const empty = t.clientHeight;
      t.value = "1\n2\n3";
      const three = t.clientHeight;
      t.value = "1\n2\n3\n4\n5\n6\n7";
      const seven = t.clientHeight;
      link.remove();
      return { props, empty, three, seven };
    });
    assert.deepEqual(r.props, {
      class: "cdk-textarea-autosize cdk-textarea-autosize-native",
      rows: 1,
      style: { "--cdk-autosize-min-rows": 2, "--cdk-autosize-max-rows": 4 },
    });
    assert.equal(r.empty, 40);
    assert.equal(r.three, 60);
    assert.equal(r.seven, 80);
  });
});

describe("AutofillMonitor", () => {
  // Spy on add / removeEventListener of three inputs (the original fixture).
  const withInputs = <T>(body: string) =>
    page.evaluate(async (src) => {
      document.body.innerHTML = '<input id="i1"><input id="i2"><input id="i3">';
      const mod = await import("/text-field/autosize.ts");
      const { normalizePassiveListenerOptions } = await import("/platform/index.ts");
      const autofillMonitor = mod.createAutofillMonitor();
      const inputs = ["i1", "i2", "i3"].map((id) => {
        const el = document.getElementById(id) as HTMLInputElement & { added: unknown[][]; removed: unknown[][]; callback?: (e: unknown) => void };
        el.added = [];
        el.removed = [];
        const add = el.addEventListener.bind(el);
        el.addEventListener = ((...args: unknown[]) => {
          el.added.push(args);
          el.callback = args[1] as never;
          (add as (...a: unknown[]) => void)(...args);
        }) as never;
        el.removeEventListener = ((...args: unknown[]) => void el.removed.push(args)) as never;
        return el;
      });
      const listenerOptions = normalizePassiveListenerOptions({ passive: true });
      const fn = new Function("autofillMonitor", "inputs", "listenerOptions", "mod", `return (async () => { ${src} })()`);
      const result = await fn(autofillMonitor, inputs, listenerOptions, mod);
      autofillMonitor.destroy();
      return result;
    }, body) as Promise<T>;

  it("should add monitored class and listener upon monitoring", async () => {
    const r = await withInputs<unknown[]>(
      `const [inputEl] = inputs;
       const before = inputEl.added.length;
       autofillMonitor.monitor(inputEl);
       return [before, inputEl.classList.contains("cdk-text-field-autofill-monitored"), inputEl.added[0][0], typeof inputEl.added[0][1], JSON.stringify(inputEl.added[0][2]) === JSON.stringify(listenerOptions)];`,
    );
    assert.deepEqual(r, [0, true, "animationstart", "function", true]);
  });

  it("should not add multiple listeners to the same element", async () => {
    const r = await withInputs<number>(
      `const [inputEl] = inputs; autofillMonitor.monitor(inputEl); autofillMonitor.monitor(inputEl); return inputEl.added.length;`,
    );
    assert.equal(r, 1);
  });

  it("should remove monitored class and listener upon stop monitoring", async () => {
    const r = await withInputs<unknown[]>(
      `const [inputEl] = inputs;
       autofillMonitor.monitor(inputEl);
       const before = [inputEl.classList.contains("cdk-text-field-autofill-monitored"), inputEl.removed.length];
       autofillMonitor.stopMonitoring(inputEl);
       return [...before, inputEl.classList.contains("cdk-text-field-autofill-monitored"), inputEl.removed[0][0], JSON.stringify(inputEl.removed[0][2]) === JSON.stringify(listenerOptions)];`,
    );
    assert.deepEqual(r, [true, 0, false, "animationstart", true]);
  });

  it("should stop monitoring all monitored elements upon destroy", async () => {
    const r = await withInputs<number[]>(
      `inputs.forEach((el) => autofillMonitor.monitor(el));
       const before = inputs.map((el) => el.removed.length);
       autofillMonitor.destroy();
       return [...before, ...inputs.map((el) => el.removed.length)];`,
    );
    assert.deepEqual(r, [0, 0, 0, 1, 1, 1]);
  });

  it("should emit and add / remove filled class upon start / end animation", async () => {
    const r = await withInputs<unknown[]>(
      `const [inputEl] = inputs;
       let event = null;
       autofillMonitor.monitor(inputEl).subscribe((e) => (event = e));
       const results = [event, inputEl.classList.contains("cdk-text-field-autofilled")];
       inputEl.callback({ animationName: "cdk-text-field-autofill-start", target: inputEl });
       results.push(inputEl.classList.contains("cdk-text-field-autofilled"), event.target === inputEl, event.isAutofilled);
       inputEl.callback({ animationName: "cdk-text-field-autofill-end", target: inputEl });
       results.push(inputEl.classList.contains("cdk-text-field-autofilled"), event.isAutofilled);
       return results;`,
    );
    assert.deepEqual(r, [null, false, true, true, true, false, false]);
  });

  it("should cleanup filled class if monitoring stopped in autofilled state", async () => {
    const r = await withInputs<boolean[]>(
      `const [inputEl] = inputs;
       autofillMonitor.monitor(inputEl);
       inputEl.callback({ animationName: "cdk-text-field-autofill-start", target: inputEl });
       const filled = inputEl.classList.contains("cdk-text-field-autofilled");
       autofillMonitor.stopMonitoring(inputEl);
       return [filled, inputEl.classList.contains("cdk-text-field-autofilled")];`,
    );
    assert.deepEqual(r, [true, false]);
  });

  it("should complete the stream when monitoring is stopped", async () => {
    const r = await withInputs<number[]>(
      `const [element] = inputs;
       let completed = 0;
       autofillMonitor.monitor(element).subscribe({ complete: () => completed++ });
       const before = completed;
       autofillMonitor.stopMonitoring(element);
       return [before, completed];`,
    );
    assert.deepEqual(r, [0, 1]);
  });

  it("should not emit on init if input is unfilled", async () => {
    const r = await withInputs<number>(
      `const [inputEl] = inputs;
       let calls = 0;
       autofillMonitor.monitor(inputEl).subscribe(() => calls++);
       inputEl.callback({ animationName: "cdk-text-field-autofill-end", target: inputEl });
       return calls;`,
    );
    assert.equal(r, 0);
  });

  it("injects the autofill keyframes once per document", async () => {
    const r = await withInputs<number>(
      `inputs.forEach((el) => autofillMonitor.monitor(el)); return document.head.querySelectorAll("style[data-cdk-text-field]").length;`,
    );
    assert.equal(r, 1);
  });
});

describe("cdkAutofill (onAutofill)", () => {
  it("should monitor host element on init and stop monitoring on destroy", async () => {
    const r = await page.evaluate(async () => {
      document.body.innerHTML = '<input id="i">';
      const { onAutofill } = await import("/text-field/autosize.ts");
      const el = document.getElementById("i")!;
      const calls: string[] = [];
      const monitor = {
        monitor: (e: Element) => (calls.push("monitor:" + e.id), { subscribe: () => ({ unsubscribe() {} }) }),
        stopMonitoring: (e: Element) => void calls.push("stop:" + (e as Element).id),
        destroy() {},
      };
      const stop = onAutofill(el, () => {}, { monitor: monitor as never });
      const afterInit = [...calls];
      stop();
      return { afterInit, calls };
    });
    assert.deepEqual(r, { afterInit: ["monitor:i"], calls: ["monitor:i", "stop:i"] });
  });
});
