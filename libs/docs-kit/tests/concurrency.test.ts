import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { mapPool, pool, readTexts } from "../tools/concurrency.ts";

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe("pool / mapPool", () => {
  it("never runs more than `size` at a time and visits every item once", async () => {
    let running = 0,
      peak = 0;
    const seen: number[] = [];
    await pool([5, 1, 4, 2, 3, 0, 2, 1], 3, async (ms, index) => {
      peak = Math.max(peak, ++running);
      await delay(ms);
      seen.push(index);
      running--;
    });
    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns results by index, whatever order they finish in", async () => {
    expect(await mapPool([30, 0, 20, 10], 4, async (ms, index) => (await delay(ms), `${index}:${ms}`))).toEqual(["0:30", "1:0", "2:20", "3:10"]);
  });

  it("throws the earliest item's error, not the first to fail in time, after every item ran", async () => {
    const ran: number[] = [];
    const run = mapPool([0, 30, 0, 10], 4, async (ms, index) => {
      await delay(ms);
      ran.push(index);
      if (index === 1 || index === 3) throw new Error(`item ${index}`);
      return index;
    });
    await expect(run).rejects.toThrow("item 1");
    expect(ran.sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("readTexts", () => {
  let dir: string;
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("yields files in input order and throws a missing file when its turn comes", async () => {
    dir = await mkdtemp(join(tmpdir(), "docs-kit-concurrency-"));
    const files = Array.from({ length: 40 }, (_, i) => join(dir, `${i}.txt`));
    await Promise.all(files.map((file, i) => writeFile(file, `text ${i}`)));
    const texts: string[] = [];
    for await (const text of readTexts(files, 7)) texts.push(text);
    expect(texts).toEqual(files.map((_, i) => `text ${i}`));
    const got: string[] = [];
    const broken = [files[0]!, files[1]!, join(dir, "missing.txt"), files[2]!];
    await expect(
      (async () => {
        for await (const text of readTexts(broken)) got.push(text);
      })(),
    ).rejects.toThrow(/ENOENT/);
    expect(got).toEqual(["text 0", "text 1"]);
  });
});
