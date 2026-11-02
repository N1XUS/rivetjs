// The status bar / region refresh (extension.ts) drops late `_rivet:sites` answers through `lastWins`: a slow answer
// for the previous editor must not overwrite what the newer refresh painted.
import assert from "node:assert/strict";
import { test } from "vitest";
import { lastWins } from "../latest.ts";

test("lastWins: an answer that arrives after a newer run started is stale", async () => {
  const runs = lastWins();
  const painted: string[] = [];
  const refresh = async (name: string, answer: Promise<string>) => {
    const current = runs.begin();
    const value = await answer;
    if (current()) painted.push(`${name}:${value}`);
  };
  let answerA!: (value: string) => void;
  const a = refresh("a", new Promise((done) => (answerA = done)));
  const b = refresh("b", Promise.resolve("dom"));
  await b;
  answerA("resume");
  await a;
  assert.deepEqual(painted, ["b:dom"]);
  // The newest run stays current until another begins.
  const current = runs.begin();
  assert.equal(current(), true);
  runs.begin();
  assert.equal(current(), false);
});
