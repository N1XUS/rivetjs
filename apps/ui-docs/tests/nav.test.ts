// Components sidebar contract: every group lists its pages alphabetically by page title (case-insensitive), and the
// chart pages sit in their own "Charts" group.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { groups } from "../content/_nav/components.ts";

const content = resolve(fileURLToPath(new URL("../content", import.meta.url)));
const title = (page: string) => /^title:\s*"?(.*?)"?\s*$/m.exec(readFileSync(resolve(content, `${page}.md`), "utf8"))![1]!;

test("components groups are sorted by page title", () => {
  for (const group of groups) {
    const titles = group.pages.map(title);
    const sorted = [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    assert.deepEqual(titles, sorted, `group "${group.title}"`);
  }
});

test("chart pages live in the Charts group", () => {
  const charts = groups.find((group) => group.title === "Charts");
  assert.ok(charts, "Charts group");
  for (const group of groups) {
    if (group !== charts) assert.ok(!group.pages.some((page) => /chart$/.test(page) && page !== "components/trend-chip"), `group "${group.title}"`);
  }
  assert.ok(charts.pages.includes("components/chart"));
});
