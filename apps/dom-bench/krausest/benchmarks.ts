// js-framework-benchmark webdriver-ts benchmarksPlaywright.ts equivalents: warmup (init) and measured (run) steps.
// Only the DOM contract is used, so any lane (any framework or API) can be driven.
import type { Page } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

export type Check = (page: Page) => Promise<void>;
export interface CPUBench {
  id: string;
  label: string;
  warmup: number;
  slowdown?: number;
  additionalRuns: number;
  init: Check;
  run: Check;
}
export interface MemBench {
  id: string;
  label: string;
  local?: true;
  init: Check;
  run: Check;
}

// ---- playwrightAccess equivalents (poll up to 10 times: 10 ms x3, then 1 s) ----
const poll = async (test: () => Promise<boolean>, what: string) => {
  for (let k = 0; k < 10; k++) {
    if (await test()) return;
    await sleep(k < 3 ? 10 : 1000);
  }
  throw Error(`check failed: ${what}`);
};
export const exists = (sel: string): Check => (page) => poll(async () => !!(await page.$(sel)), `exists ${sel}`);
const notExists = (sel: string): Check => (page) => poll(async () => !(await page.$(sel)), `not exists ${sel}`);
const containsText = (sel: string, text: string): Check => (page) =>
  poll(async () => {
    const element = await page.$(sel);
    return !!element && (await element.innerText()).includes(text);
  }, `${sel} contains ${JSON.stringify(text)}`);
const hasClass = (sel: string, name: string): Check => (page) =>
  poll(async () => !!(await page.$eval(sel, (e, name) => e.classList.contains(name), name).catch(() => false)), `${sel} has class ${name}`);
const count = async (page: Page, sel: string, expected: number) => {
  const n = (await page.$$(sel)).length;
  if (n !== expected) throw Error(`count ${sel}: expected ${expected}, got ${n}`);
};
export const click = async (page: Page, sel: string) => {
  const element = await page.$(sel);
  if (!element) throw Error(`click: ${sel} not found`);
  await element.click();
  await element.dispose();
};
export const row = (n: number, td: number, rest = "") => `tbody>tr:nth-of-type(${n})>td:nth-of-type(${td})${rest}`;
const createClear = async (page: Page, warmup: number) => {
  for (let i = 0; i < warmup; i++) {
    await click(page, "#run");
    await containsText(row(1, 1), (i * 1000 + 1).toFixed())(page);
    await click(page, "#clear");
    await notExists(row(1000, 1))(page);
  }
};

// ---- benchmarksPlaywright.ts equivalents ----
export const cpuBenchmarks: CPUBench[] = [
  {
    id: "01_run1k", label: "create rows", warmup: 5, additionalRuns: 0,
    init: (page) => exists("#run")(page).then(() => createClear(page, 5)),
    run: async (page) => { await click(page, "#run"); await containsText(row(1000, 1), (6 * 1000).toFixed())(page); },
  },
  {
    id: "02_replace1k", label: "replace all rows", warmup: 5, additionalRuns: 0,
    init: async (page) => {
      await exists("#run")(page);
      for (let i = 0; i < 5; i++) { await click(page, "#run"); await containsText(row(1, 1), (i * 1000 + 1).toFixed())(page); }
    },
    run: async (page) => { await click(page, "#run"); await containsText(row(1, 1), `${5 * 1000 + 1}`)(page); },
  },
  {
    id: "03_update10th1k_x16", label: "partial update", warmup: 3, slowdown: 4, additionalRuns: 0,
    init: async (page) => {
      await exists("#run")(page); await click(page, "#run"); await exists(row(1000, 1))(page);
      for (let i = 0; i < 3; i++) { await click(page, "#update"); await containsText(row(991, 2, ">a"), " !!!".repeat(i + 1))(page); }
    },
    run: async (page) => { await click(page, "#update"); await containsText(row(991, 2, ">a"), " !!!".repeat(4))(page); },
  },
  {
    id: "04_select1k", label: "select row", warmup: 5, slowdown: 4, additionalRuns: 10,
    init: async (page) => {
      await exists("#run")(page); await click(page, "#run"); await containsText(row(1000, 1), "1000")(page);
      await click(page, row(5, 2, ">a")); await hasClass("tbody>tr:nth-of-type(5)", "danger")(page); await count(page, "tbody>tr.danger", 1);
    },
    run: async (page) => { await click(page, row(2, 2, ">a")); await hasClass("tbody>tr:nth-of-type(2)", "danger")(page); },
  },
  {
    id: "05_swap1k", label: "swap rows", warmup: 5, slowdown: 4, additionalRuns: 0,
    init: async (page) => {
      await exists("#run")(page); await click(page, "#run"); await exists(row(1000, 1))(page);
      for (let i = 0; i <= 5; i++) { await click(page, "#swaprows"); await containsText(row(999, 1), i % 2 === 0 ? "2" : "999")(page); }
    },
    run: async (page) => {
      await click(page, "#swaprows");
      await containsText(row(999, 1), "2")(page);
      await containsText(row(2, 1), "999")(page);
    },
  },
  {
    id: "06_remove-one-1k", label: "remove row", warmup: 5, slowdown: 2, additionalRuns: 0,
    init: async (page) => {
      const skip = 4, warmup = 5;
      await exists("#run")(page); await click(page, "#run"); await exists(row(1000, 1))(page);
      for (let i = 0; i < warmup; i++) {
        const n = warmup - i + skip;
        await containsText(row(n, 1), String(n))(page);
        await click(page, row(n, 3, ">a>span:nth-of-type(1)"));
        await containsText(row(n, 1), `${skip + warmup + 1}`)(page);
      }
      await containsText(row(skip + 1, 1), `${skip + warmup + 1}`)(page);
      await containsText(row(skip, 1), `${skip}`)(page);
      await containsText(row(skip + 2, 1), `${skip + warmup + 2}`)(page);
      await click(page, row(skip + 2, 3, ">a>span:nth-of-type(1)"));
      await containsText(row(skip + 2, 1), `${skip + warmup + 3}`)(page);
    },
    run: async (page) => { await click(page, row(4, 3, ">a>span:nth-of-type(1)")); await containsText(row(4, 1), "10")(page); },
  },
  {
    id: "07_create10k", label: "create many rows", warmup: 5, additionalRuns: 0,
    init: (page) => exists("#run")(page).then(() => createClear(page, 5)),
    run: async (page) => { await click(page, "#runlots"); await exists(row(10000, 2, ">a"))(page); },
  },
  {
    id: "08_create1k-after1k_x2", label: "append rows to large table", warmup: 5, additionalRuns: 0,
    init: async (page) => { await exists("#run")(page); await createClear(page, 5); await click(page, "#run"); await exists(row(1000, 1))(page); },
    run: async (page) => { await click(page, "#add"); await exists(row(2000, 1))(page); },
  },
  {
    id: "09_clear1k_x8", label: "clear rows", warmup: 5, slowdown: 4, additionalRuns: 0,
    init: async (page) => {
      await exists("#run")(page); await createClear(page, 5);
      await click(page, "#run"); await containsText(row(1, 1), (5 * 1000 + 1).toFixed())(page);
    },
    run: async (page) => { await click(page, "#clear"); await notExists(row(1000, 1))(page); },
  },
  // Local-only extension (requested scenario, not a published krausest benchmark): append 1k to 10k rows, 2x slowdown.
  {
    id: "local_append1k-to10k", label: "append 1k rows to 10k (local)", warmup: 5, slowdown: 2, additionalRuns: 0,
    init: async (page) => { await exists("#run")(page); await createClear(page, 5); await click(page, "#runlots"); await exists(row(10000, 1))(page); },
    run: async (page) => { await click(page, "#add"); await exists(row(11000, 1))(page); },
  },
];
export const memBenchmarks: MemBench[] = [
  { id: "21_ready-memory", label: "ready memory", init: exists("#run"), run: async () => {} },
  { id: "22_run-memory", label: "run memory", init: exists("#run"), run: async (page) => { await click(page, "#run"); await exists(row(1, 2, ">a"))(page); } },
  {
    id: "25_run-clear-memory", label: "creating/clearing 1k rows (5 cycles)", init: exists("#run"),
    run: async (page) => {
      for (let i = 0; i < 5; i++) {
        await click(page, "#run"); await containsText(row(1000, 1), (1000 * (i + 1)).toFixed())(page);
        await click(page, "#clear"); await notExists(row(1000, 1))(page);
      }
    },
  },
  // webdriver-ts keeps 26 defined but disabled; measured locally because the scoreboard asks for it.
  { id: "26_run-10k-memory", label: "run memory 10k", local: true, init: exists("#runlots"), run: async (page) => { await click(page, "#runlots"); await exists(row(10000, 2, ">a"))(page); } },
  { id: "local_clear-memory", label: "clear memory (run 1k, clear)", local: true, init: exists("#run"), run: async (page) => { await click(page, "#run"); await exists(row(1000, 1))(page); await click(page, "#clear"); await notExists(row(1, 1))(page); } },
];
