// AI eval (scripts/ai-eval): the tasks are well formed, every seeded reference solution passes all five
// checks, and typical wrong answers fail the check that should catch them.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkFiles, grade, promptOf, readOutput } from "../ai-eval/run.ts";
import { TASKS } from "../ai-eval/tasks.ts";

const reference = resolve(import.meta.dirname, "../ai-eval/reference");
const scratch = mkdtempSync(join(tmpdir(), "ai-eval-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("ai-eval tasks", () => {
  it("about 20 tasks with unique ids, prompts naming their files, references for every file", () => {
    expect(TASKS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TASKS.map((task) => task.id)).size).toBe(TASKS.length);
    for (const task of TASKS) {
      expect(task.steps.length, task.id).toBeGreaterThan(0);
      for (const file of task.files) expect(promptOf(task), task.id).toContain(file);
      expect(checkFiles(task, readOutput(resolve(reference, task.id))), task.id).toMatchObject({ ok: true });
    }
  });

  it("every reference solution passes (files, rv, build, typecheck, behaviour)", { timeout: 900_000 }, async () => {
    const results = await grade({ outputs: reference });
    const failed = results.filter((result) => !result.ok).map((result) => ({ id: result.id, failed: result.checks.find((c) => !c.ok) }));
    expect(failed).toEqual([]);
    expect(results.every((result) => result.checks.length === 5)).toBe(true);
  });

  it("wrong answers fail the check that catches them", { timeout: 120_000 }, async () => {
    const write = (id: string, path: string, text: string) => {
      const file = join(scratch, id, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    };
    // React habit: hooks import → files check.
    write(
      "counter-step",
      "src/routes/index.tsx",
      'import { useState } from "react";\nexport default function Home() {\n  const [n] = useState(0);\n  return <output id="count">{n}</output>;\n}\n',
    );
    // Lowercase DOM event name → RV1012.
    write(
      "filter-list",
      "src/routes/index.tsx",
      'import { signal } from "@rivetjs/reactivity";\nexport default function Home() {\n  const q = signal("");\n  return <input id="q" onclick={() => q.set("")} />;\n}\n',
    );
    // Browser global during server rendering → RV2001.
    write("window-size", "src/routes/index.tsx", 'export default function Home() {\n  return <span id="width">{window.innerWidth}</span>;\n}\n');
    // Plain variable instead of a signal: compiles, but the page never updates → behaviour.
    write(
      "live-props",
      "src/components/Badge.tsx",
      'export function Badge(props: { count: number; label: string }) {\n  return <span class="badge" data-empty={props.count === 0 ? "" : undefined}>{props.count} {props.label}</span>;\n}\n',
    );
    write(
      "live-props",
      "src/routes/index.tsx",
      'import { Badge } from "../components/Badge.tsx";\nexport default function Home() {\n  let items = 0;\n  return (\n    <main>\n      <div id="cart"><Badge count={items} label="items" /></div>\n      <button id="add" type="button" onClick={() => (items += 1)}>Add</button>\n      <button id="clear" type="button" onClick={() => (items = 0)}>Clear</button>\n    </main>\n  );\n}\n',
    );
    const results = await grade({ outputs: scratch, ids: ["counter-step", "filter-list", "window-size", "live-props"] });
    const firstFailure = Object.fromEntries(results.map((result) => [result.id, result.checks.find((c) => !c.ok)?.check]));
    expect(firstFailure).toEqual({ "counter-step": "files", "filter-list": "rv", "window-size": "rv", "live-props": "behaviour" });
    expect(results.find((result) => result.id === "filter-list")!.checks[1]!.detail).toContain("RV1012");
    expect(results.find((result) => result.id === "window-size")!.checks[1]!.detail).toContain("RV2001");
  });
});
